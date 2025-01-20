import { ApolloClient, InMemoryCache, split, HttpLink, ApolloLink } from '@apollo/client'
import { getMainDefinition } from '@apollo/client/utilities'
import { Observable } from '@apollo/client/utilities'
import { getUserId } from './userId'
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev"

// Load Apollo error messages in development
if (process.env.NODE_ENV !== 'production') {
  loadDevMessages()
  loadErrorMessages()
}

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
        console.error(`SSE: Subscription request failed for ${operationName}:`, {
          status: response.status,
          statusText: response.statusText
        })
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
        console.log(`SSE: Connection opened for ${operationName}`, {
          readyState: eventSource.readyState,
          url: eventSource.url
        })
      }

      // Listen for subscription data
      eventSource.addEventListener('next', (event) => {
        try {
          const data = JSON.parse(event.data)
          // Create a proper GraphQL result format
          const result = {
            data: data.data,
            errors: data.errors,
            extensions: data.extensions,
            type: 'data'
          }
          observer.next(result)
        } catch (err) {
          console.error(`SSE: Error processing next event for ${operationName}:`, err)
          observer.error(err)
        }
      })

      // Listen for subscription completion
      eventSource.addEventListener('complete', () => {
        console.log(`SSE: Subscription completed for ${operationName}`)
        observer.complete()
        eventSource.close()
      })

      // Listen for subscription errors
      eventSource.addEventListener('error', (event) => {
        console.error(`SSE: Error event for ${operationName}:`, {
          error: event,
          readyState: eventSource.readyState
        })
        if (eventSource.readyState === EventSource.CLOSED) {
          observer.complete()
        } else {
          observer.error(event)
        }
      })

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