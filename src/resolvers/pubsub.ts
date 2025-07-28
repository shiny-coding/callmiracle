import { RedisPubSub } from 'graphql-redis-subscriptions'
import { isBuilding } from '@/utils'

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

let pubsub: any

if (isBuilding) {
  pubsub = mockPubSub
} else {
  try {
    // Synchronous initialization for server environment
    const Redis = require('ioredis')
    const { logger } = require('../utils/logger')
    
    const redisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      connectTimeout: 5000,
      lazyConnect: false, // Connect immediately to test connectivity
      maxRetriesPerRequest: 0, // No retries
      retryDelayOnFailover: false, // No retry on failover
      enableOfflineQueue: false, // Don't queue commands when disconnected
      enableReadyCheck: true, // Ensure connection is ready
    }

    logger.info(`Attempting to connect to Redis at ${redisOptions.host}:${redisOptions.port}`)

    const publisher = new Redis(redisOptions)
    const subscriber = new Redis(redisOptions)

    // Set up error handlers that will exit the process
    publisher.on('error', (error: any) => {
      logger.error('Redis publisher connection failed - shutting down server', { 
        error: error.message,
        host: redisOptions.host,
        port: redisOptions.port
      })
      process.exit(1)
    })
    
    subscriber.on('error', (error: any) => {
      logger.error('Redis subscriber connection failed - shutting down server', { 
        error: error.message,
        host: redisOptions.host,
        port: redisOptions.port
      })
      process.exit(1)
    })

    // Add success handlers
    publisher.on('connect', () => {
      logger.info('Redis publisher connected successfully')
    })
    
    subscriber.on('connect', () => {
      logger.info('Redis subscriber connected successfully')
    })

    pubsub = new RedisPubSub({
      publisher,
      subscriber,
    })
    
    logger.info('Redis PubSub initialized - testing connectivity')
    
  } catch (error) {
    const { logger } = require('../utils/logger')
    logger.error('Failed to initialize Redis pubsub - shutting down server', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    })
    process.exit(1)
  }
}

export { pubsub } 