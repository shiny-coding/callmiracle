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
    mongodb: true,
    webrtc: true
  }
}

// Cache for user configs to avoid frequent DB queries
const configCache = new Map<string, { config: UserInstrumentationConfig; timestamp: number }>()
// Track ongoing cache warming operations to prevent duplicates
const cacheWarming = new Set<string>()

function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id)
}
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const CACHE_CLEANUP_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

// Auto-cleanup expired cache entries
setInterval(() => {
  const now = Date.now()
  for (const [userId, data] of configCache.entries()) {
    if (now - data.timestamp > CACHE_TTL_MS) {
      configCache.delete(userId)
    }
  }
}, CACHE_CLEANUP_INTERVAL_MS)

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
 * Get user instrumentation config synchronously from cache only
 * Used by sampler for fast lookups
 */
export function getUserInstrumentationConfigSync(userId: string): UserInstrumentationConfig {
  if (!isValidObjectId(userId)) return DEFAULT_INSTRUMENTATION_CONFIG
  
  const cached = configCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.config
  }

  // Cache miss - trigger async warming and return admin config (full instrumentation)
  if (!cacheWarming.has(userId)) {
    warmUserConfigCache(userId)
  }

  return ADMIN_INSTRUMENTATION_CONFIG // Full instrumentation until cache is ready
}

/**
 * Warm cache for user config in background
 */
function warmUserConfigCache(userId: string): void {
  if (cacheWarming.has(userId)) return
  
  cacheWarming.add(userId)
  
  getUserInstrumentationConfig(userId)
    .then(() => {
      // Config is now cached for future requests
    })
    .catch(error => {
      console.warn(`Failed to warm cache for user ${userId}:`, error)
    })
    .finally(() => {
      cacheWarming.delete(userId)
    })
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