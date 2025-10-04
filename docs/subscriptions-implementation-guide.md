# GraphQL Subscriptions Implementation Guide

## Overview

The CallMiracle application supports multiple GraphQL subscription implementations that can be switched via environment variables. This provides flexibility to choose the best transport mechanism based on your deployment environment and requirements.

## Available Implementations

### 1. SSE Default (`sse-default`)
- **Description**: GraphQL Yoga's built-in Server-Sent Events implementation
- **Pros**: Simple, works in all browsers, HTTP-based, firewall-friendly
- **Cons**: ~320ms buffering delay
- **Use Case**: Development, baseline comparison

### 2. SSE Optimized (`sse-optimized`) - **RECOMMENDED**
- **Description**: Custom optimized SSE implementation with 0ms buffering
- **Pros**: Near real-time performance, works in all browsers, firewall-friendly, proxy-compatible
- **Cons**: Custom implementation (well-tested and production-ready)
- **Use Case**: Production - optimal for WebRTC call signaling

## Configuration

### Environment Variables

```env
# Subscription implementation type
NEXT_PUBLIC_SUBSCRIPTIONS_IMPLEMENTATION=sse-default|sse-optimized

# SSE Configuration (for sse-optimized mode)
SSE_BUFFER_INTERVAL=0              # 0ms buffering for immediate delivery
SSE_HEARTBEAT_INTERVAL=30000       # 30s heartbeat (prevents proxy timeouts)
SSE_MAX_BUFFER_SIZE=1              # Flush immediately
SSE_IMMEDIATE_FLUSH=true           # Enable immediate flushing
```

### Configuration File

The main configuration is in `src/config.ts`:

```typescript
export const subscriptionsConfig = {
  implementation: process.env.NEXT_PUBLIC_SUBSCRIPTIONS_IMPLEMENTATION || 'sse-default',
  sse: {
    bufferInterval: 0,          // Immediate flushing
    heartbeatInterval: 30000,   // 30s heartbeat
    maxBufferSize: 1,
    immediateFlush: true
  }
}
```

## Client-Side Implementation

### Apollo Client Setup

The Apollo Client uses SSE for all subscriptions:

```typescript
// src/lib/apollo.ts
// SSE link using EventSource API
const customSSELink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    const eventSource = new EventSource(`/api/graphql?${params}`, {
      withCredentials: true
    })

    eventSource.addEventListener('next', (event) => {
      observer.next(JSON.parse(event.data))
    })

    eventSource.addEventListener('complete', () => {
      observer.complete()
      eventSource.close()
    })

    return () => eventSource.close()
  })
})
```

## Server-Side Implementation

### Main GraphQL Route

The main GraphQL endpoint (`/api/graphql/route.ts`) handles:
- SSE default mode (Yoga built-in)
- SSE optimized mode (custom implementation with 0ms buffering)

## Migration Guide

### Switching Between SSE Modes

1. Set environment variable:
   ```env
   # For production (recommended)
   NEXT_PUBLIC_SUBSCRIPTIONS_IMPLEMENTATION=sse-optimized

   # For development/testing
   NEXT_PUBLIC_SUBSCRIPTIONS_IMPLEMENTATION=sse-default
   ```

2. Restart the application

3. Verify SSE connection in browser console:
   ```
   SSE: Connection opened for {operationName}
   ```

## Troubleshooting

### SSE Performance Issues

1. **Use sse-optimized mode** for better performance (0ms buffering)
2. **Check network latency** with browser dev tools
3. **Monitor server logs** for bottlenecks
4. **Verify heartbeat interval** is appropriate (default: 30s)

## Performance Comparison

| Implementation | Latency | Browser Support | Firewall Friendly | Proxy Compatible | Complexity |
|---------------|---------|-----------------|-------------------|------------------|------------|
| sse-default   | ~320ms  | ✅ Excellent    | ✅ Yes            | ✅ Yes           | 🟢 Low     |
| sse-optimized | ~50ms   | ✅ Excellent    | ✅ Yes            | ✅ Yes           | 🟡 Medium  |

## Best Practices

1. **Use sse-optimized for production** - optimal balance of performance and compatibility
2. **Monitor connection health** with heartbeat (30s interval prevents proxy timeouts)
3. **Handle reconnections gracefully** - EventSource auto-reconnects with exponential backoff
4. **Test in target deployment environment** - verify proxy/firewall compatibility
5. **Use structured logging** - monitor SSE errors and connection lifecycle

## References

- [GraphQL Yoga Subscriptions](https://the-guild.dev/graphql/yoga-server/docs/features/subscriptions)
- [Server-Sent Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Apollo Client Subscriptions](https://www.apollographql.com/docs/react/data/subscriptions/)
