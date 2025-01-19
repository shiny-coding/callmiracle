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
          console.log(`SSE: Received message for ${operationName}:`, {
            type: event.type,
            eventId: event.lastEventId,
            data: event.data.slice(0, 100) + '...' // Log first 100 chars to keep it readable
          })

          const data = JSON.parse(event.data)
          
          if (data.data?.onConnectionRequest) {
            console.log(`SSE: Processing connection request for ${operationName}:`, {
              from: data.data.onConnectionRequest.from.name,
              hasOffer: !!data.data.onConnectionRequest.offer,
              timestamp: new Date().toISOString()
            })
            observer.next(data)
          } else if (data.data?.onUsersUpdated) {
            console.log(`SSE: Processing users update for ${operationName}:`, {
              userCount: data.data.onUsersUpdated.length,
              timestamp: new Date().toISOString()
            })
            observer.next(data)
          } else {
            console.log(`SSE: Received unknown data type for ${operationName}:`, {
              dataKeys: Object.keys(data.data || {}),
              timestamp: new Date().toISOString()
            })
            observer.next(data)
          }
        } catch (err) {
          console.error(`SSE: Error processing message for ${operationName}:`, err)
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