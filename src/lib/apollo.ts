import { ApolloClient, InMemoryCache, split, HttpLink, ApolloLink } from '@apollo/client'
import { getMainDefinition } from '@apollo/client/utilities'
import { Observable } from '@apollo/client/utilities'
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev"
import { syncStore, vanillaStore} from '@/store/useStore'
import { formatGraphQLResponseError, generateShortRequestId } from '@/utils/commonUtils'

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

const sseLink = new ApolloLink((operation) => {
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

    eventSource.onopen = () => {
      console.log(`SSE: Connection opened for ${operationName}`)
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
    eventSource.addEventListener('error', (event) => {
      console.error(`SSE: Error event for ${operationName}:`, event)
      observer.error(event)
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
  // Compose links: requestId -> logging -> split(http/sse)
  link: ApolloLink.from([requestIdLink, loggingLink, splitLink]),
  cache: new InMemoryCache(),
  credentials: 'include'
}) 