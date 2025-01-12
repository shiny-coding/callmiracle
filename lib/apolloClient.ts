import { ApolloClient, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: '/graphql.schema', // Updated to match the new endpoint
  cache: new InMemoryCache(),
});

export default client; 