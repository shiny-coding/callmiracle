import { trace, context as otelContext } from '@opentelemetry/api'
import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/mongodb'
import { getRequestContext } from './requestContext'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export interface UserInstrumentationConfig {
  samplingRate: number         // 0.0-1.0
  enableTracing: boolean
  enableMetrics: boolean
  verbosityLevel: 'MINIMAL' | 'STANDARD' | 'DETAILED'
  instrumentations: {
    http: boolean
    graphql: boolean
    mongodb: boolean
    webrtc: boolean
  }
}

export const DEFAULT_INSTRUMENTATION_CONFIG: UserInstrumentationConfig = {
  samplingRate: 0.1,          // 10% sampling by default
  enableTracing: true,
  enableMetrics: false,
  verbosityLevel: 'STANDARD',
  instrumentations: {
    http: true,
    graphql: true,
    mongodb: false,           // Expensive, off by default
    webrtc: false            // Very noisy, off by default
  }
}

// Admin/developer level config for full instrumentation
export const ADMIN_INSTRUMENTATION_CONFIG: UserInstrumentationConfig = {
  samplingRate: 1.0,          // 100% sampling for admins
  enableTracing: true,
  enableMetrics: true,
  verbosityLevel: 'DETAILED',
  instrumentations: {
    http: true,
    graphql: true,
    mongodb: true,
    webrtc: true
  }
}

// Cache for user configs to avoid frequent DB queries
const configCache = new Map<string, { config: UserInstrumentationConfig; timestamp: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 5 minutes

/**
 * Get instrumentation configuration for a specific user
 */
export async function getUserInstrumentationConfig(userId: string): Promise<UserInstrumentationConfig> {
  // Check cache first
  const cached = configCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.config
  }

  try {
    const usersCollection = await getCollection('users')
    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId) },
      { projection: { instrumentationConfig: 1 } }
    )

    let config: UserInstrumentationConfig
    if (user?.instrumentationConfig) {
      // Merge with defaults to ensure all fields are present
      config = {
        ...DEFAULT_INSTRUMENTATION_CONFIG,
        ...user.instrumentationConfig,
        instrumentations: {
          ...DEFAULT_INSTRUMENTATION_CONFIG.instrumentations,
          ...user.instrumentationConfig.instrumentations
        }
      }
    } else {
      config = DEFAULT_INSTRUMENTATION_CONFIG
    }

    // Cache the result
    configCache.set(userId, { config, timestamp: Date.now() })
    return config
  } catch (error) {
    console.error('Failed to get user instrumentation config:', error)
    return DEFAULT_INSTRUMENTATION_CONFIG
  }
}

/**
 * Get current user's instrumentation config from session context
 * Only works within request context
 */
export async function getCurrentUserInstrumentationConfig(): Promise<UserInstrumentationConfig> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return DEFAULT_INSTRUMENTATION_CONFIG
    }
    return await getUserInstrumentationConfig(session.user.id)
  } catch (error) {
    // This is expected when called outside request context (e.g., during startup)
    return DEFAULT_INSTRUMENTATION_CONFIG
  }
}

/**
 * Update instrumentation configuration for a user
 */
export async function updateUserInstrumentationConfig(
  userId: string, 
  config: Partial<UserInstrumentationConfig>
): Promise<void> {
  try {
    const usersCollection = await getCollection('users')
    
    // Get current config to merge
    const currentConfig = await getUserInstrumentationConfig(userId)
    const updatedConfig = {
      ...currentConfig,
      ...config,
      instrumentations: {
        ...currentConfig.instrumentations,
        ...config.instrumentations
      }
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          instrumentationConfig: updatedConfig,
          updatedAt: Date.now()
        } 
      }
    )

    // Update cache
    configCache.set(userId, { config: updatedConfig, timestamp: Date.now() })
  } catch (error) {
    console.error('Failed to update user instrumentation config:', error)
    throw error
  }
}

/**
 * Check if current span should be sampled based on user config
 */
export async function shouldSampleCurrentSpan(): Promise<boolean> {
  try {
    const config = await getCurrentUserInstrumentationConfig()
    
    if (!config.enableTracing) {
      return false
    }

    // Use sampling rate for normal operations
    // Note: Error and slow request sampling is handled in the span processor
    return Math.random() < config.samplingRate
  } catch (error) {
    console.error('Failed to determine sampling:', error)
    return true // Default to sampling on error
  }
}

/**
 * Check if specific instrumentation is enabled for current user
 */
export async function isInstrumentationEnabled(type: keyof UserInstrumentationConfig['instrumentations']): Promise<boolean> {
  try {
    const config = await getCurrentUserInstrumentationConfig()
    return config.instrumentations[type]
  } catch (error) {
    console.error('Failed to check instrumentation enabled:', error)
    return DEFAULT_INSTRUMENTATION_CONFIG.instrumentations[type]
  }
}

/**
 * Check if we're in a request context by testing if headers are available
 */
function isInRequestContext(): boolean {
  try {
    // This will throw if called outside request context
    process.env.NODE_ENV // This won't throw, but the headers() call below will
    return true
  } catch {
    return false
  }
}

/**
 * Get user ID from various contexts (request headers, session, span attributes)
 * Gracefully handles being called outside request context
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    // Try to get from request context first (set by middleware) - this is most reliable
    const requestContext = await getRequestContext()
    if (requestContext.userId && requestContext.userId !== 'anonymous') {
      return requestContext.userId
    }

    // Only try session if we got a valid request context (not the fallback)
    if (requestContext.requestId !== 'unknown') {
      try {
        const session = await getServerSession(authOptions)
        if (session?.user?.id) {
          return session.user.id
        }
      } catch (sessionError) {
        // Expected when called outside request context, continue
      }
    }

    return null
  } catch (error) {
    // This is expected during startup or outside request context
    return null
  }
}

/**
 * Clear config cache for a user (useful after updates)
 */
export function clearUserConfigCache(userId: string): void {
  configCache.delete(userId)
}

/**
 * Clear entire config cache
 */
export function clearAllConfigCache(): void {
  configCache.clear()
}

/**
 * Get cache statistics for monitoring
 */
export function getConfigCacheStats() {
  return {
    size: configCache.size,
    entries: Array.from(configCache.entries()).map(([userId, data]) => ({
      userId,
      timestamp: data.timestamp,
      age: Date.now() - data.timestamp
    }))
  }
}