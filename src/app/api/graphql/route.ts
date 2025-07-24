import { createYoga } from 'graphql-yoga'
import { schema } from '@/schema/schema'
import clientPromise, { getDatabaseName } from '@/lib/mongodb'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import { getLogger } from '@/utils/logger'
import { formatGraphQLResponseError } from '@/utils/commonUtils'

// Helper function to extract operation name from request
async function getOperationName(request: Request): Promise<string> {
  const url = new URL(request.url)
  
  // Try GET params first
  const getOperationName = url.searchParams.get('operationName')
  if (getOperationName) {
    return getOperationName
  }
  
  // Try POST body for JSON requests
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const clone = request.clone()
      const body = await clone.json()
      return body.operationName || 'unnamed'
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  return request.method === 'GET' ? 'GET query' : 'unnamed'
}

// Helper function to handle GraphQL errors in responses
async function handleGraphQLResponse(
  response: Response, 
  request: Request, 
  logger: any,
  method: 'GET' | 'POST'
): Promise<Response> {
  // Check for GraphQL errors in response body (even with 200 status)
  if (response.headers.get('content-type')?.includes('application/json')) {
    const clonedResponse = response.clone()
    try {
      const responseData = await clonedResponse.json()
      if (responseData.errors && responseData.errors.length > 0) {
        const operationName = await getOperationName(request)
        logger.error(...formatGraphQLResponseError(responseData, operationName))
      }
    } catch (e) {
      // Ignore JSON parsing errors for non-JSON responses
    }
  }
  
  // Log HTTP-level errors (non-200 responses)
  if (!response.ok) {
    const clonedResponse = response.clone()
    const responseBody = await clonedResponse.text()
    const operationName = await getOperationName(request)
    
    logger.error(`GraphQL HTTP Error Response`, {
      method,
      status: response.status,
      operationName,
      responseBody
    })
  }
  
  return response
}

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
    const operationName = await getOperationName(request)
    
    logger.info('SSE GET Request', {
      operationName,
      isSSE: true,
      accept: request.headers.get('accept')
    })
  }
  
  try {
    const response = await yoga.fetch(request)
    
    // Handle GraphQL errors using unified helper
    const handledResponse = await handleGraphQLResponse(response, request, logger, 'GET')

    // Add SSE headers if needed
    if (request.headers.get('accept')?.includes('text/event-stream')) {
      handledResponse.headers.set('Content-Type', 'text/event-stream')
      handledResponse.headers.set('Connection', 'keep-alive')
      handledResponse.headers.set('Cache-Control', 'no-cache')
    }

    return handledResponse
  } catch (error) {
    const operationName = await getOperationName(request)
    logger.error('GraphQL GET handler error', {
      operationName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: request.url
    })
    throw error
  }
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

  try {
    const response = await yoga.fetch(request)
    
    // Handle GraphQL errors using unified helper
    return await handleGraphQLResponse(response, request, logger, 'POST')
  } catch (error) {
    const operationName = await getOperationName(request)
    logger.error('GraphQL POST handler error', {
      operationName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
} 