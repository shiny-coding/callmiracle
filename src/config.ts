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