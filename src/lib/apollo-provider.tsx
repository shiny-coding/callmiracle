'use client';

import { ApolloProvider } from '@apollo/client';
import { getUserId } from './userId';
import { client } from './apollo';

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={client}>
      {children}
    </ApolloProvider>
  );
} 