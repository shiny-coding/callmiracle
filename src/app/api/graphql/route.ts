import { createYoga } from 'graphql-yoga'
import { schema } from '@/schema/schema'
import clientPromise, { getDatabaseName } from '@/lib/mongodb'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import { getLogger } from '@/utils/logger'
import { formatGraphQLResponseError } from '@/utils/commonUtils'
import { subscriptionsConfig } from '@/config'
import { createOptimizedSSEResponse } from '@/lib/sse-optimized'
import { subscribe, parse, validate } from 'graphql'

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

// Create GraphQL context
async function createGraphQLContext(request: Request) {
  const client = await clientPromise
  const dbName = getDatabaseName()
  const db = client.db(dbName)
  const session = await getServerSession(authOptions)
  
  // Get logger from AsyncLocalStorage context (set by middleware)
  const logger = await getLogger()
  
  return { db, session, logger, request }
}

const yoga = createYoga<any, any>({
  schema,
  context: createGraphQLContext,
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response },
  // Enable GraphiQL with SSE subscriptions protocol
  graphiql: {
    subscriptionsProtocol: 'SSE'
  }
})

// Export request handlers
export const GET = async (request: Request) => {
  const logger = await getLogger()
  
  // Check if this is an SSE request
  const isSSERequest = request.headers.get('accept')?.includes('text/event-stream')
  
  if (isSSERequest) {
    const operationName = await getOperationName(request)

    logger.info('SSE GET Request', {
      operationName,
      isSSE: true,
      implementation: subscriptionsConfig.implementation,
      accept: request.headers.get('accept')
    })

    // Use optimized SSE implementation if configured
    if (subscriptionsConfig.implementation === 'sse-optimized') {
      try {
        return await handleOptimizedSSE(request, logger)
      } catch (error) {
        logger.error('Optimized SSE handler error', {
          operationName,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
        throw error
      }
    }

    // For 'sse-default' mode, let Yoga handle it with built-in SSE
  }
  
  try {
    const response = await yoga.fetch(request)
    
    // Handle GraphQL errors using unified helper
    const handledResponse = await handleGraphQLResponse(response, request, logger, 'GET')


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

// Handle optimized SSE requests
async function handleOptimizedSSE(request: Request, logger: any): Promise<Response> {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')
  const variables = url.searchParams.get('variables')
  const operationName = url.searchParams.get('operationName')

  if (!query) {
    throw new Error('No GraphQL query provided for SSE subscription')
  }

  try {
    // Parse and validate the query
    const document = parse(query)
    const validationErrors = validate(schema, document)

    if (validationErrors.length > 0) {
      throw new Error(`GraphQL validation errors: ${validationErrors.map(e => e.message).join(', ')}`)
    }

    // Create GraphQL context
    const context = await createGraphQLContext(request)

    // Use subscribe instead of execute for subscriptions
    const result = await subscribe({
      schema,
      document,
      contextValue: context,
      variableValues: variables ? JSON.parse(variables) : {},
      operationName: operationName || undefined
    })

    // Check if result is an async iterable (subscription)
    if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
      return createOptimizedSSEResponse(result as AsyncIterable<any>, request, logger)
    } else {
      // subscribe returned an error result
      logger.error('Subscription returned error result', {
        operationName,
        result
      })
      throw new Error('Failed to create subscription: ' + JSON.stringify(result))
    }
  } catch (error) {
    logger.error('Optimized SSE execution error', {
      operationName,
      error: error instanceof Error ? error.message : String(error)
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