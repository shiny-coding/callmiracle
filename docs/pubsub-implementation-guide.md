# PubSub Implementation Guide

## Overview

CallMiracle supports two PubSub implementations for GraphQL subscriptions that can be switched via environment variables. This provides flexibility to choose between distributed Redis-based PubSub or simple in-memory PubSub based on your deployment requirements.

## Available Implementations

### 1. Redis PubSub (`redis`) - Default
- **Description**: Redis-based distributed PubSub using `graphql-redis-subscriptions`
- **Pros**:
  - Works across multiple server instances
  - Supports horizontal scaling
  - Persistent connection management
  - Production-ready for distributed systems
- **Cons**:
  - Requires Redis server running
  - External dependency
  - Network latency overhead
- **Use Case**: Production deployments with multiple servers, horizontal scaling, distributed systems

### 2. Internal PubSub (`internal`)
- **Description**: In-memory PubSub using `graphql-subscriptions`
- **Pros**:
  - No external dependencies
  - Zero network latency
  - Simple setup
  - Perfect for development
- **Cons**:
  - Only works on single server instance
  - No persistence
  - Memory-only (data lost on restart)
  - Cannot scale horizontally
- **Use Case**: Development, single-server deployments, testing

## Configuration

### Environment Variable

```env
# PubSub implementation type
PUBSUB_IMPLEMENTATION=redis  # or 'internal'
```

### Configuration File

The configuration is defined in `src/config.ts`:

```typescript
export const pubSubConfig = {
  implementation: (process.env.PUBSUB_IMPLEMENTATION as 'redis' | 'internal') || 'redis'
} as const;
```

## Implementation Details

### PubSub Initialization

The PubSub system is initialized in `src/lib/pubsub.ts`:

```typescript
function initializePubSub() {
  const implementation = pubSubConfig.implementation

  if (implementation === 'internal') {
    // Use in-memory PubSub
    pubsub = new PubSub()
  } else {
    // Use Redis-based PubSub
    const publisher = new Redis(redisOptions)
    const subscriber = new Redis(redisOptions)
    pubsub = new RedisPubSub({ publisher, subscriber })
  }

  return pubsub
}
```

### Redis Configuration

When using Redis PubSub, you can configure the connection:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

Redis connection options (in `pubsub.ts`):
- `connectTimeout`: 2000ms
- `maxRetriesPerRequest`: null (required for pub/sub)
- `keepAlive`: 30000ms
- `commandTimeout`: 5000ms

### Error Handling

Both implementations include robust error handling:

**Redis PubSub**:
- Connection failures result in server shutdown (fail-fast approach)
- Separate error handlers for publisher and subscriber
- Connection success logging

**Internal PubSub**:
- Automatic initialization
- No external dependencies to fail
- Graceful degradation during build time

## Usage in Resolvers

Both implementations provide the same API, so your resolvers work identically:

```typescript
import { pubsub } from '@/lib/pubsub'

// Publish an event
await pubsub.publish('MESSAGE_SENT', {
  messageSent: message
})

// Subscribe to events
Subscription: {
  messageSent: {
    subscribe: () => pubsub.asyncIterator(['MESSAGE_SENT'])
  }
}
```

## Migration Guide

### From Redis to Internal

1. Stop your application
2. Set environment variable:
   ```env
   PUBSUB_IMPLEMENTATION=internal
   ```
3. Restart the application
4. Verify in logs: `Internal PubSub initialized successfully`

**Note**: Internal PubSub only works with single server instance. If you have multiple servers, they won't share subscriptions.

### From Internal to Redis

1. Ensure Redis server is running:
   ```bash
   yarn redis:up
   # or
   docker-compose -f docker-compose.redis.yml up -d
   ```

2. Set environment variable:
   ```env
   PUBSUB_IMPLEMENTATION=redis
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

3. Restart the application

4. Verify in logs:
   ```
   Attempting to connect to Redis at localhost:6379
   Redis publisher connected successfully
   Redis subscriber connected successfully
   Redis PubSub initialized - testing connectivity
   ```

## Architecture Comparison

### Single Server Deployment

```
┌─────────────────────────────────────┐
│         Next.js Server              │
│  ┌───────────────────────────────┐  │
│  │   Internal PubSub (Memory)    │  │
│  │  ┌─────────┐    ┌──────────┐ │  │
│  │  │Publisher│───►│Subscriber│ │  │
│  │  └─────────┘    └──────────┘ │  │
│  └───────────────────────────────┘  │
│         ↓              ↓            │
│    Client 1       Client 2          │
└─────────────────────────────────────┘
```

**Best for**: Development, testing, single-server production

### Multi-Server Deployment (Requires Redis)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Server 1   │    │   Server 2   │    │   Server 3   │
│  Publisher   │    │  Publisher   │    │  Publisher   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ↓
                   ┌───────────────┐
                   │ Redis PubSub  │
                   │  Distributed  │
                   └───────────────┘
                           ↑
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────┴───────┐    ┌──────┴───────┐    ┌──────┴───────┐
│   Server 1   │    │   Server 2   │    │   Server 3   │
│  Subscriber  │    │  Subscriber  │    │  Subscriber  │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
   Client 1            Client 2            Client 3
```

**Best for**: Production with load balancing, horizontal scaling

## Performance Considerations

### Internal PubSub
- **Latency**: <1ms (in-memory)
- **Throughput**: Very high (no network overhead)
- **Memory**: Proportional to active subscriptions
- **CPU**: Minimal

### Redis PubSub
- **Latency**: 1-5ms (network + Redis processing)
- **Throughput**: High (Redis is optimized for pub/sub)
- **Memory**: Redis server memory
- **CPU**: Minimal (Redis handles most work)

## Best Practices

1. **Use Redis for production** with multiple servers or horizontal scaling
2. **Use Internal for development** for faster iteration without external dependencies
3. **Monitor memory usage** with Internal PubSub (no automatic cleanup)
4. **Configure Redis properly** for production (persistence, memory limits)
5. **Test failover scenarios** with Redis (what happens when Redis goes down)
6. **Use health checks** to verify PubSub is working

## Troubleshooting

### Redis Connection Issues

**Symptom**: Server shuts down immediately after start

**Check**:
```bash
# Verify Redis is running
yarn redis:cli
# Should connect without errors
```

**Solution**:
- Ensure Redis is running: `yarn redis:up`
- Check Redis host/port in environment variables
- Check network connectivity to Redis server
- Review Redis logs: `yarn redis:logs`

### Internal PubSub Not Working Across Servers

**Symptom**: Subscriptions only work on same server that published event

**Reason**: Internal PubSub is in-memory and cannot communicate across processes

**Solution**: Switch to Redis PubSub for multi-server deployments

### Memory Leaks with Internal PubSub

**Symptom**: Memory usage grows over time

**Reason**: Active subscriptions not being cleaned up

**Solution**:
- Ensure clients properly unsubscribe
- Implement subscription limits
- Monitor active subscription count
- Switch to Redis PubSub for production

## Testing

### Testing Redis PubSub

```bash
# Start Redis
yarn redis:up

# Test Redis pub/sub directly
yarn redis:cli
> SUBSCRIBE test_channel
# In another terminal:
yarn redis:cli
> PUBLISH test_channel "hello"

# Test with GraphQL
yarn test:pubsub
```

### Testing Internal PubSub

```bash
# Set environment variable
export PUBSUB_IMPLEMENTATION=internal

# Start server
yarn dev

# Test GraphQL subscriptions through GraphiQL
# Navigate to http://localhost:3003/api/graphql
```

## Integration with Subscriptions

PubSub implementation is independent of the GraphQL subscriptions transport (SSE vs WebSocket):

| PubSub | Subscriptions Transport | Works? | Use Case |
|--------|------------------------|--------|----------|
| Redis | SSE | ✅ Yes | Production multi-server |
| Redis | WebSocket | ✅ Yes | Production multi-server |
| Internal | SSE | ✅ Yes | Development single-server |
| Internal | WebSocket | ✅ Yes | Development single-server |

Both configurations are controlled independently:
- `PUBSUB_IMPLEMENTATION` - Backend event distribution
- `NEXT_PUBLIC_SUBSCRIPTIONS_IMPLEMENTATION` - Client-server communication

## References

- [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions)
- [graphql-redis-subscriptions](https://github.com/davidyaha/graphql-redis-subscriptions)
- [Redis PubSub Documentation](https://redis.io/docs/manual/pubsub/)
