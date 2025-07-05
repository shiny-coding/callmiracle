import { createYoga } from 'graphql-yoga'
import { schema } from '@/schema/schema'
import clientPromise, { getDatabaseName } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'

// Lazy yoga creation to avoid immediate database connection during build
let yogaInstance: any = null

function getYoga() {
  if (!yogaInstance) {
    yogaInstance = createYoga({
      schema,
      context: async ({ request }) => {
        const client = await clientPromise
        const dbName = getDatabaseName()
        const db = client.db(dbName)
        const session = await getServerSession(authOptions)
        return { db, session }
      },
      graphqlEndpoint: '/api/graphql',
      fetchAPI: { Response },
      // Enable GraphiQL with SSE support
      graphiql: {
        subscriptionsProtocol: 'SSE'
      },
    })
  }
  return yogaInstance
}

// Export request handlers
export const GET = async (request: Request) => {
  const yoga = getYoga()
  
  // Log SSE requests with minimal info
  if (request.headers.get('accept')?.includes('text/event-stream')) {
    const url = new URL(request.url)
    const userId = url.searchParams.get('x-user-id')

    // Get username from database
    let username = 'unknown'
    if (userId) {
      const client = await clientPromise
      const dbName = getDatabaseName()
      const db = client.db(dbName)
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
      username = user?.name || 'unknown'
    }

    console.log('SSE GET Request:', {
      operationName: url.searchParams.get('operationName'),
      userId,
      username,
      timestamp: new Date().toISOString()
    })
  }

  const response = await yoga.fetch(request)

  // Add SSE headers if needed
  if (request.headers.get('accept')?.includes('text/event-stream')) {
    response.headers.set('Content-Type', 'text/event-stream')
    response.headers.set('Connection', 'keep-alive')
    response.headers.set('Cache-Control', 'no-cache')
  }

  return response
}

export const POST = async (request: Request) => {
  const yoga = getYoga()
  
  // Optional: Enhanced logging for POST requests
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const clone = request.clone()
      const body = await clone.json()
      const query = body.query?.substring(0, 100) // Truncate long queries
      const operationName = body.operationName || 'unnamed'

      // Get user session for logging
      const session = await getServerSession(authOptions)
      const userPart = session?.user ? `User: ${session.user.name} (${session.user.id})` : 'Unauthenticated'

      console.log(
        `[${new Date().toLocaleTimeString()}] GraphQL Request: ${operationName} | ${userPart}`
      )
    } catch (e) {
      // Silently continue if we can't parse the body
    }
  }
  
  // Clone request early for error logging if needed
  const clonedRequest = request.clone()
  let requestBody: string | undefined

  try {
    const response = await yoga.fetch(request)
    
    // Only log non-200 responses
    if (!response.ok) {
      // Clone response to read body
      const clonedResponse = response.clone()
      const responseBody = await clonedResponse.text()

      // Read body only if we need it for error logging
      if (!requestBody) {
        requestBody = await clonedRequest.text()
      }
      
      try {
        const parsedBody = JSON.parse(requestBody)
        console.error('GraphQL Error:', {
          status: response.status,
          operationName: parsedBody.operationName,
          variables: parsedBody.variables,
          query: parsedBody.query?.slice(0, 100) + '...',
          response: responseBody
        })
      } catch (e) {
        console.error('GraphQL Error:', {
          status: response.status,
          body: requestBody,
          response: responseBody
        })
      }
    }

    return response
  } catch (error) {
    // For unhandled errors, also include request context
    if (!requestBody) {
      requestBody = await clonedRequest.text()
    }
    console.error('Error in POST handler:', error, {
      body: requestBody
    })
    throw error
  }
} 