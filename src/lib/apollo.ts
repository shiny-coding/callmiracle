import { ApolloClient, InMemoryCache, split, HttpLink, ApolloLink } from '@apollo/client'
import { getMainDefinition } from '@apollo/client/utilities'
import { Observable } from '@apollo/client/utilities'

const httpLink = new HttpLink({
  uri: '/api/graphql'
})

const sseLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    const url = new URL('/api/graphql', window.location.href)
    const params = new URLSearchParams()
    params.append('query', operation.query.loc?.source.body || '')
    params.append('operationName', operation.operationName || '')
    if (operation.variables) {
      params.append('variables', JSON.stringify(operation.variables))
    }
    url.search = params.toString()

    const eventSource = new EventSource(url.toString(), {
      withCredentials: true
    })

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.errors) {
        observer.error(data.errors[0])
      } else {
        observer.next(data)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close()
        observer.complete()
      } else {
        observer.error(error)
      }
    }

    return () => {
      eventSource.close()
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
  link: splitLink,
  cache: new InMemoryCache()
}) 