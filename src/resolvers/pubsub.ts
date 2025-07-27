import { RedisPubSub } from 'graphql-redis-subscriptions'
import { PubSubEvents } from './subscriptions'

// Check if we're in build mode or browser environment
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' || process.argv.includes('build')
const isBrowser = typeof window !== 'undefined'

// Mock pubsub for build time and browser
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

// Initialize pubsub synchronously
let pubsub: any

if (isBuilding || isBrowser) {
  pubsub = mockPubSub
} else {
  try {
    // Synchronous initialization for server environment
    /* eslint-disable */
    const Redis = require('ioredis')
    
    const redisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    }

    pubsub = new RedisPubSub({
      publisher: new Redis(redisOptions),
      subscriber: new Redis(redisOptions),
    })
    
    console.log('Redis PubSub initialized synchronously')
  } catch (error) {
    console.warn('Failed to initialize Redis pubsub, using mock:', error)
    pubsub = mockPubSub
  }
}

export { pubsub } 