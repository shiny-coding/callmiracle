import { createYoga } from 'graphql-yoga'
import { schema } from '@/schema/schema'
import clientPromise, { getDatabaseName } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import { getLogger } from '@/utils/logger'

// Create yoga instance
const yoga = createYoga({
  schema,
  context: async ({ request }): Promise<{ db: any, session: any, logger: any }> => {
    const client = await clientPromise
    const dbName = getDatabaseName()
    const db = client.db(dbName)
    const session = await getServerSession(authOptions)
    
    // Get logger from AsyncLocalStorage context (set by middleware)
    const logger = await getLogger()
    
    return { db, session, logger }
  },
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response },
  // Enable GraphiQL with SSE support
  graphiql: {
    subscriptionsProtocol: 'SSE'
  },
})

// Export request handlers
export const GET = async (request: Request) => {
  const logger = await getLogger()
  
  // Log SSE requests
  if (request.headers.get('accept')?.includes('text/event-stream')) {
    const url = new URL(request.url)
    const operationName = url.searchParams.get('operationName')
    
    logger.info('SSE GET Request', {
      operationName,
      isSSE: true,
      accept: request.headers.get('accept')
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
  const logger = await getLogger()
  
  // Enhanced logging for POST requests
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const clone = request.clone()
      const body = await clone.json()
      const query = body.query?.substring(0, 100) // Truncate long queries
      const operationName = body.operationName || 'unnamed'

      logger.info('GraphQL Request: ' + operationName, {
        operationName,
        queryPreview: query
      })
    } catch (e) {
      logger.warn('Failed to parse GraphQL request body', {
        contentType: request.headers.get('content-type'),
        error: e instanceof Error ? e.message : String(e)
      })
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
        logger.error('GraphQL Error Response', {
          status: response.status,
          operationName: parsedBody.operationName,
          queryPreview: parsedBody.query?.slice(0, 100) + '...',
          responseBody
        })
      } catch (e) {
        logger.error('GraphQL Error Response (unparseable)', {
          status: response.status,
          requestBody,
          responseBody
        })
      }
    }

    return response
  } catch (error) {
    // For unhandled errors, also include request context
    if (!requestBody) {
      requestBody = await clonedRequest.text()
    }
    logger.error('GraphQL handler error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestBody
    })
    throw error
  }
} 