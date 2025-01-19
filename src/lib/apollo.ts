import { ApolloClient, InMemoryCache, split, HttpLink, ApolloLink } from '@apollo/client'
import { getMainDefinition } from '@apollo/client/utilities'
import { Observable } from '@apollo/client/utilities'
import { getUserId } from './userId'

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
          console.log(`SSE: Received message for ${operationName}`, data)
          if (data.errors) {
            observer.error(data.errors[0])
          } else {
            observer.next(data)
          }
        } catch (err) {
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
  link: splitLink,
  cache: new InMemoryCache(),
  credentials: 'include'
}) 