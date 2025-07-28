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
    const { logger } = require('../utils/logger')
    
    const redisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      // Limit connection retries to prevent spam
      connectTimeout: 5000,
      lazyConnect: true, // Don't connect immediately
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false, // Don't queue commands when disconnected
    }

    const publisher = new Redis(redisOptions)
    const subscriber = new Redis(redisOptions)

    // Track error logging to prevent spam
    let lastErrorTime = 0
    const ERROR_LOG_THROTTLE = 30000 // Log errors max once per 30 seconds

    // Add error handlers to intercept connection errors
    publisher.on('error', (error: any) => {
      const now = Date.now()
      if (now - lastErrorTime > ERROR_LOG_THROTTLE) {
        logger.error('Redis publisher connection error (throttled)', { error: error.message })
        lastErrorTime = now
      }
    })
    
    subscriber.on('error', (error: any) => {
      const now = Date.now()
      if (now - lastErrorTime > ERROR_LOG_THROTTLE) {
        logger.error('Redis subscriber connection error (throttled)', { error: error.message })
        lastErrorTime = now
      }
    })

    // Add connection event handlers for better debugging
    publisher.on('connect', () => {
      logger.info('Redis publisher connected')
    })
    
    subscriber.on('connect', () => {
      logger.info('Redis subscriber connected')
    })

    pubsub = new RedisPubSub({
      publisher,
      subscriber,
    })
    
    logger.info('Redis PubSub initialized (connections will be established lazily)')
  } catch (error) {
    const { logger } = require('../utils/logger')
    logger.warn('Failed to initialize Redis pubsub, using mock', { error: (error as Error).message, stack: (error as Error).stack })
    pubsub = mockPubSub
  }
}

export { pubsub } 