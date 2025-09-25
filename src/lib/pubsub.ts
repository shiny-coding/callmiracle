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

// Use global to ensure true singleton across webpack bundles
const globalKey = Symbol.for('callmiracle.pubsub')
const globalIsInitializedKey = Symbol.for('callmiracle.pubsub.initialized')

function initializePubSub() {
  // Check if already initialized across all bundles
  if ((global as any)[globalIsInitializedKey]) {
    return (global as any)[globalKey]
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
        connectTimeout: 2000,
        lazyConnect: false,
        // CRITICAL: maxRetriesPerRequest must be null for pub/sub (from ioredis docs)
        maxRetriesPerRequest: null,
        retryDelayOnFailover: false,
        enableOfflineQueue: false,
        enableReadyCheck: true,
        // Pub/sub optimizations
        keepAlive: 30000,
        commandTimeout: 5000,
        family: 4,
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

  // Store in global for cross-bundle access
  (global as any)[globalKey] = pubsub;
  (global as any)[globalIsInitializedKey] = true
  
  return pubsub
}

// Get or initialize pubsub instance
const pubsub = initializePubSub()

export { pubsub } 