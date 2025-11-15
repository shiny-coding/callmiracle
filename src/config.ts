export const locales = ['en', 'ru'] as const;
export type Locale = typeof locales[number];

export const defaultLocale = 'en' as const;

// PubSub Implementation Configuration
export const pubSubConfig = {
  // Flag to switch between PubSub implementations
  // 'redis' = Redis-based PubSub (distributed, works across multiple servers)
  // 'internal' = In-memory PubSub (single server, no external dependencies)
  implementation: (process.env.PUBSUB_IMPLEMENTATION as 'redis' | 'internal') || 'redis'
} as const;

// GraphQL Subscriptions Implementation Configuration
export const subscriptionsConfig = {
  // Flag to switch between subscription implementations
  // 'sse-default' = GraphQL Yoga built-in SSE implementation (~320ms buffering)
  // 'sse-optimized' = Custom optimized SSE implementation with 0ms buffering
  implementation: (process.env.NEXT_PUBLIC_SUBSCRIPTIONS_IMPLEMENTATION as 'sse-default' | 'sse-optimized') || 'sse-default',

  // Performance settings for SSE optimized implementation
  sse: {
    // Reduce buffering interval from default ~320ms to immediate
    bufferInterval: parseInt(process.env.SSE_BUFFER_INTERVAL || '0'),
    // Heartbeat to keep connection alive
    heartbeatInterval: parseInt(process.env.SSE_HEARTBEAT_INTERVAL || '30000'),
    // Maximum buffered events before flushing
    maxBufferSize: parseInt(process.env.SSE_MAX_BUFFER_SIZE || '1'),
    // Enable immediate flushing for real-time experience
    immediateFlush: process.env.SSE_IMMEDIATE_FLUSH !== 'false'
  }
} as const;

// Broadcast Batching Configuration
export const broadcastConfig = {
  // Server-side: Batch broadcast events within this interval (milliseconds)
  // Multiple MEETING_UPDATED events within this window will be batched into a single broadcast
  // Set to 0 to disable batching (immediate broadcasts)
  batchIntervalMs: parseInt(process.env.BROADCAST_BATCH_INTERVAL_MS || '3000'),
} as const;

// Client-side Refetch Configuration
export const refetchConfig = {
  // Client-side: Minimum delay before refetching after receiving broadcast (milliseconds)
  minDelayMs: parseInt(process.env.NEXT_PUBLIC_REFETCH_MIN_DELAY_MS || '1000'),

  // Client-side: Maximum delay before refetching after receiving broadcast (milliseconds)
  // Clients will wait a random time between min and max to scatter database load
  maxDelayMs: parseInt(process.env.NEXT_PUBLIC_REFETCH_MAX_DELAY_MS || '5000'),
} as const; 