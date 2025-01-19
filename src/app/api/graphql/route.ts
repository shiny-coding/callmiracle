import { createYoga } from 'graphql-yoga'
import { schema } from '@/schema'
import clientPromise from '@/lib/mongodb'

const yoga = createYoga({
  schema,
  context: async () => {
    const client = await clientPromise
    const db = client.db('commiracle')
    return { db }
  },
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response },
  // Enable GraphiQL with SSE support
  graphiql: {
    subscriptionsProtocol: 'SSE'
  }
})

// Export request handlers
export const GET = async (request: Request) => {
  // Only log SSE connections
  if (request.headers.get('accept')?.includes('text/event-stream')) {
    console.log('SSE GET Request')
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
  // Clone request early for error logging if needed
  const clonedRequest = request.clone()
  let requestBody: string | undefined

  try {
    const response = await yoga.fetch(request)
    
    // Only log non-200 responses
    if (!response.ok) {
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
          query: parsedBody.query?.slice(0, 100) + '...'
        })
      } catch (e) {
        console.error('GraphQL Error:', {
          status: response.status,
          body: requestBody
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