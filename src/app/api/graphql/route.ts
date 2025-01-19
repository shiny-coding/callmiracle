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
  console.log('GET Request:', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries())
  })

  const response = await yoga.fetch(request)
  console.log('GET Response:', {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries())
  })

  // Add SSE headers if needed
  if (request.headers.get('accept')?.includes('text/event-stream')) {
    console.log('Adding SSE headers to response')
    response.headers.set('Content-Type', 'text/event-stream')
    response.headers.set('Connection', 'keep-alive')
    response.headers.set('Cache-Control', 'no-cache')
  }
  return response
}

export const POST = async (request: Request) => {
  // Clone request to read body
  const clonedRequest = request.clone()
  const body = await clonedRequest.text()
  
  console.log('POST Request:', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: body
  })

  try {
    const parsedBody = JSON.parse(body)
    console.log('Parsed GraphQL operation:', {
      operationName: parsedBody.operationName,
      variables: parsedBody.variables,
      query: parsedBody.query?.slice(0, 100) + '...' // Log first 100 chars of query
    })
  } catch (e) {
    console.log('Could not parse request body')
  }

  try {
    const response = await yoga.fetch(request)
    console.log('POST Response:', {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      type: response.type,
      bodyUsed: response.bodyUsed
    })

    // Try to read and log response body if possible
    if (response.bodyUsed === false) {
      const clonedResponse = response.clone()
      try {
        const responseBody = await clonedResponse.text()
        console.log('Response body:', responseBody)
      } catch (e) {
        console.log('Could not read response body')
      }
    }

    return response
  } catch (error) {
    console.error('Error in POST handler:', error)
    throw error
  }
} 