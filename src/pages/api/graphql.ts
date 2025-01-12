import { ApolloServer } from 'apollo-server-micro';
import { resolvers } from '../../resolvers';
import { gql } from 'graphql-tag';
import fs from 'fs';
import path from 'path';

const typeDefs = gql(fs.readFileSync(path.join(process.cwd(), 'src/schema/schema.graphql'), 'utf8'));

const apolloServer = new ApolloServer({ typeDefs, resolvers });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default apolloServer.createHandler({ path: '/api/graphql' }); 