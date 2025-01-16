import { createYoga } from 'graphql-yoga'
import { schema } from '@/schema'
import clientPromise from '../../../lib/mongodb'

const { handleRequest } = createYoga({
  schema,
  context: async () => {
    const client = await clientPromise
    const db = client.db('commiracle')
    return { db }
  },
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response }
})

export { handleRequest as GET, handleRequest as POST } 