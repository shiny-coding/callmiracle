import { ApolloClient, InMemoryCache, split, HttpLink, ApolloLink } from '@apollo/client'
import { getMainDefinition } from '@apollo/client/utilities'
import { Observable } from '@apollo/client/utilities'
import { getUserId } from './userId'

// Logging link to intercept all requests
const loggingLink = new ApolloLink((operation, forward) => {
  return forward(operation).map(response => {
    // Only log if there are GraphQL errors
    if (response.errors && response.errors.length > 0) {
      console.error(`GraphQL Error (${operation.operationName || 'unnamed'}):`, {
        errors: response.errors,
        query: operation.query.loc?.source.body,
        variables: operation.variables
      })
    }
    return response
  })
})

const httpLink = new HttpLink({
  uri: '/api/graphql',
  credentials: 'include',
  headers: {
    'x-user-id': getUserId()
  }
})

const sseLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    const operationName = operation.operationName || 'unnamed'
    console.log(`SSE: Establishing connection for ${operationName}`)

    // First send the subscription request
    fetch('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-user-id': getUserId()
      },
      body: JSON.stringify({
        query: operation.query.loc?.source.body,
        variables: operation.variables,
        operationName: operation.operationName,
        extensions: {
          subscription: {
            protocol: 'SSE'
          }
        }
      })
    }).then(response => {
      if (!response.ok) {
        throw new Error(`Subscription request failed: ${response.status}`)
      }
      
      // If subscription request successful, establish SSE connection
      const eventSource = new EventSource('/api/graphql?' + new URLSearchParams({
        query: operation.query.loc?.source.body || '',
        variables: JSON.stringify(operation.variables || {}),
        operationName: operation.operationName || '',
        extensions: JSON.stringify({
          subscription: { protocol: 'SSE' }
        }),
        'x-user-id': getUserId()
      }), {
        withCredentials: true 
      })

      eventSource.onopen = () => {
        console.log(`SSE: Connection opened for ${operationName}`)
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.data?.onConnectionRequest) {
            console.log('SSE: Received connection request from:', data.data.onConnectionRequest.from.name)
          }
          if (data.errors) {
            console.error('SSE: Event contains errors:', data.errors)
            observer.error(data.errors[0])
          } else {
            observer.next(data)
          }
        } catch (err) {
          console.error('SSE: Error parsing event data:', err)
          observer.error(err)
        }
      }

      eventSource.onerror = (error) => {
        console.error(`SSE: Connection error for ${operationName}:`, error)
        observer.error(error)
      }

      return () => {
        console.log(`SSE: Closing connection for ${operationName}`)
        eventSource.close()
      }
    }).catch(error => {
      console.error(`SSE: Failed to setup ${operationName}:`, error)
      observer.error(error)
    })

    return () => {}
  })
})

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query)
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    )
  },
  sseLink,
  httpLink
)

export const client = new ApolloClient({
  // Compose links: logging -> split(http/sse)
  link: ApolloLink.from([loggingLink, splitLink]),
  cache: new InMemoryCache(),
  credentials: 'include'
}) 