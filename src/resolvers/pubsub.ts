import { RedisPubSub } from 'graphql-redis-subscriptions'
import { PubSubEvents } from './subscriptions'
import Redis from 'ioredis'

// Check if we're in build mode
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' || process.argv.includes('build')

// Mock pubsub for build time
const mockPubSub = {
  publish: async () => Promise.resolve(),
  subscribe: async () => Promise.resolve(() => {}),
  unsubscribe: async () => Promise.resolve(),
  asyncIterator: () => ({
    [Symbol.asyncIterator]: async function* () {
      // Empty async iterator for build time
    }
  })
}

// Create Redis connection options
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
}

// Create pubsub instance
export const pubsub = isBuilding 
  ? mockPubSub as any
  : new RedisPubSub({
      publisher: new Redis(redisOptions),
      subscriber: new Redis(redisOptions),
    }) as any 