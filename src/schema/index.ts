import { createSchema } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolvers } from '@/resolvers';

const typeDefs = readFileSync(join(process.cwd(), 'src/schema/schema.graphql'), 'utf8');

export const schema = createSchema({
  typeDefs,
  resolvers
}); 