import { ApolloClient, InMemoryCache, split, HttpLink, ApolloLink } from '@apollo/client'
import { getMainDefinition } from '@apollo/client/utilities'
import { Observable } from '@apollo/client/utilities'
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev"
import { syncStore, vanillaStore} from '@/store/useStore'
import { formatGraphQLResponseError, generateShortRequestId } from '@/utils/commonUtils'
import { subscriptionsConfig } from '@/config'

function getUserId() {
  return syncStore().currentUser?._id || ''
}

// Load Apollo error messages in development
if (process.env.NODE_ENV !== 'production') {
  loadDevMessages()
  loadErrorMessages()
}

// Request ID injection link - adds requestId to context and headers
const requestIdLink = new ApolloLink((operation, forward) => {
  const requestId = generateShortRequestId()
  
  // Add requestId to operation context
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      'x-request-id': requestId
    },
    requestId
  }))
  
  return forward(operation)
})

// Logging link to intercept all requests
const loggingLink = new ApolloLink((operation, forward) => {
  // Get requestId from operation context
  const requestId = operation.getContext().requestId || 'unknown'

  return forward(operation).map(response => {
    // Only log if there are GraphQL errors
    if (response.errors && response.errors.length > 0) {
      const [message, params] = formatGraphQLResponseError(response, operation.operationName || 'unnamed')
      console.error(message + `(req: ${requestId})`, params)
    }
    return response
  })
})

// Custom HTTP link that adds operationName and requestId to URL
const httpLink = new ApolloLink((operation, forward) => {
  const requestId = operation.getContext().requestId || 'unknown'
  const operationName = operation.operationName || 'unnamed'
  
  // Build URL with query parameters for visibility
  const params = new URLSearchParams({
    operationName,
    requestId
  })
  
  const httpLinkWithDynamicUri = new HttpLink({
    uri: `/api/graphql?${params.toString()}`,
    credentials: 'include',
    headers: {
      'x-user-id': getUserId()
    }
  })
  
  return httpLinkWithDynamicUri.request(operation, forward)
})

// SSE link for sse-default and sse-optimized modes (using EventSource)
const customSSELink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    const operationName = operation.operationName || 'unnamed'
    const requestId = operation.getContext().requestId || generateShortRequestId()
    let eventSource: EventSource | null = null
    let unsubscribed = false

    // Build the EventSource URL with query parameters (skip the POST request)
    const params = new URLSearchParams({
      query: operation.query.loc?.source.body || '',
      variables: JSON.stringify(operation.variables || {}),
      operationName: operation.operationName || '',
      extensions: JSON.stringify({
        subscription: { protocol: 'SSE' }
      }),
      'x-user-id': getUserId()
    })

    eventSource = new EventSource(`/api/graphql?${params.toString()}`, {
      withCredentials: true
    })

    let reconnectCount = 0

    eventSource.onopen = () => {
      if (reconnectCount > 0) {
        console.log(`SSE: Reconnected for ${operationName} (attempt ${reconnectCount})`)
      } else {
        console.log(`SSE: Connection opened for ${operationName}`)
      }
      reconnectCount++
    }

    // Listen for subscription data
    eventSource.addEventListener('next', (event) => {
      try {
        const data = JSON.parse(event.data)
        observer.next(data)
      } catch (err) {
        console.error(`SSE: Error parsing event for ${operationName}:`, err)
        observer.error(err)
      }
    })

    // Listen for subscription completion
    eventSource.addEventListener('complete', () => {
      console.log(`SSE: Subscription completed for ${operationName}`)
      observer.complete()
      eventSource?.close()
    })

    // Listen for subscription errors
    eventSource.addEventListener('error', (event: Event) => {
      const target = event.target as EventSource

      // EventSource has 3 readyState values:
      // 0 = CONNECTING (reconnecting after error)
      // 1 = OPEN (connection is open)
      // 2 = CLOSED (connection closed, won't reconnect)

      if (target.readyState === EventSource.CONNECTING) {
        // Transient error - browser is reconnecting automatically
        console.warn(`SSE: Connection lost for ${operationName}, reconnecting...`)
        // Don't call observer.error() - let EventSource reconnect
      } else if (target.readyState === EventSource.CLOSED) {
        // Fatal error - connection permanently closed
        console.error(`SSE: Connection permanently closed for ${operationName}`)
        observer.error(new Error('SSE connection permanently closed'))
      } else {
        // Unexpected state
        console.error(`SSE: Error event for ${operationName}:`, event)
      }
    })

    // Return a cleanup function that will be called on unsubscribe
    return () => {
      unsubscribed = true
      if (eventSource) {
        console.log(`SSE: Closing connection for ${operationName}`)
        eventSource.close()
      }
    }
  })
})


// Use SSE for all subscriptions
console.log(`Using SSE (${subscriptionsConfig.implementation}) for GraphQL subscriptions`)
const subscriptionLink = customSSELink

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query)

    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    )
  },
  subscriptionLink,
  httpLink
)

export const client = new ApolloClient({
  // Compose links: requestId -> logging -> split(http/sse)
  link: ApolloLink.from([requestIdLink, loggingLink, splitLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          getMessages: {
            // Don't merge - just replace with incoming data
            // This prevents the "Cache data may be lost" warning
            merge(existing, incoming) {
              return incoming
            }
          }
        }
      }
    }
  }),
  credentials: 'include'
}) 