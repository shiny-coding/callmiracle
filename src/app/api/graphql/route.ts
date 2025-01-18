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
  fetchAPI: { Response }
})

// Export request handlers
export const GET = async (request: Request) => {
  if (request.headers.get('accept') === 'text/event-stream') {
    const response = await yoga.fetch(request)
    response.headers.set('Content-Type', 'text/event-stream')
    response.headers.set('Connection', 'keep-alive')
    response.headers.set('Cache-Control', 'no-cache')
    return response
  }
  return yoga.fetch(request)
}

export const POST = async (request: Request) => {
  return yoga.fetch(request)
} 