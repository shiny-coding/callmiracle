import { createYoga } from 'graphql-yoga'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { resolvers } from '../../../resolvers'
import { readFileSync } from 'fs'
import { join } from 'path'

const typeDefs = readFileSync(join(process.cwd(), 'src/schema/schema.graphql'), 'utf8')

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})

const { handleRequest } = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response }
})

export { handleRequest as GET, handleRequest as POST } 