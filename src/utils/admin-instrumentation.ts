import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/mongodb'
import { 
  UserInstrumentationConfig, 
  DEFAULT_INSTRUMENTATION_CONFIG,
  ADMIN_INSTRUMENTATION_CONFIG,
  updateUserInstrumentationConfig,
  clearUserConfigCache,
  clearAllConfigCache
} from './user-instrumentation'

export interface InstrumentationPreset {
  name: string
  description: string
  config: UserInstrumentationConfig
}

// Predefined instrumentation presets
export const INSTRUMENTATION_PRESETS: Record<string, InstrumentationPreset> = {
  minimal: {
    name: 'Minimal',
    description: 'Minimal instrumentation for basic monitoring',
    config: {
      samplingRate: 0.05,
      enableTracing: true,
      enableMetrics: false,
      verbosityLevel: 'MINIMAL',
      instrumentations: {
        http: true,
        graphql: false,
        mongodb: false,
        webrtc: false
      }
    }
  },
  standard: {
    name: 'Standard',
    description: 'Standard instrumentation for regular users',
    config: DEFAULT_INSTRUMENTATION_CONFIG
  },
  detailed: {
    name: 'Detailed',
    description: 'Detailed instrumentation for power users',
    config: {
      samplingRate: 0.5,
      enableTracing: true,
      enableMetrics: true,
      verbosityLevel: 'DETAILED',
      instrumentations: {
        http: true,
        graphql: true,
        mongodb: true,
        webrtc: false
      }
    }
  },
  admin: {
    name: 'Admin/Developer',
    description: 'Full instrumentation for administrators and developers',
    config: ADMIN_INSTRUMENTATION_CONFIG
  },
  debug: {
    name: 'Debug Mode',
    description: 'Maximum instrumentation for debugging specific issues',
    config: {
      samplingRate: 1.0,
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
  }
}

/**
 * Apply a preset configuration to a user
 */
export async function applyInstrumentationPreset(userId: string, presetName: keyof typeof INSTRUMENTATION_PRESETS): Promise<void> {
  const preset = INSTRUMENTATION_PRESETS[presetName]
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`)
  }

  await updateUserInstrumentationConfig(userId, preset.config)
  console.log(`Applied ${preset.name} instrumentation preset to user ${userId}`)
}

/**
 * Apply preset to multiple users by email pattern or user IDs
 */
export async function bulkApplyInstrumentationPreset(
  presetName: keyof typeof INSTRUMENTATION_PRESETS,
  criteria: { userIds?: string[]; emailPattern?: string; adminUsers?: boolean }
): Promise<{ applied: number; errors: string[] }> {
  const preset = INSTRUMENTATION_PRESETS[presetName]
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`)
  }

  const usersCollection = await getCollection('users')
  const query: any = {}

  if (criteria.userIds) {
    query._id = { $in: criteria.userIds.map(id => new ObjectId(id)) }
  } else if (criteria.emailPattern) {
    query.email = { $regex: criteria.emailPattern, $options: 'i' }
  } else if (criteria.adminUsers) {
    // Assuming admin users have specific email patterns or roles
    query.email = { $regex: '@(admin|dev|support)', $options: 'i' }
  }

  const users = await usersCollection.find(query, { projection: { _id: 1, email: 1 } }).toArray()
  
  let applied = 0
  const errors: string[] = []

  for (const user of users) {
    try {
      await updateUserInstrumentationConfig(user._id.toString(), preset.config)
      applied++
      console.log(`Applied ${preset.name} preset to ${user.email} (${user._id})`)
    } catch (error) {
      const errorMsg = `Failed to apply preset to ${user.email}: ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
    }
  }

  return { applied, errors }
}

/**
 * Get instrumentation statistics across all users
 */
export async function getInstrumentationStats(): Promise<{
  totalUsers: number
  usersWithConfig: number
  presetDistribution: Record<string, number>
  averageSamplingRate: number
  enabledInstrumentations: Record<string, number>
}> {
  const usersCollection = await getCollection('users')
  
  const totalUsers = await usersCollection.countDocuments()
  const usersWithConfig = await usersCollection.countDocuments({ instrumentationConfig: { $exists: true } })
  
  const usersWithInstrumentation = await usersCollection.find(
    { instrumentationConfig: { $exists: true } },
    { projection: { instrumentationConfig: 1 } }
  ).toArray()

  const presetDistribution: Record<string, number> = {}
  const enabledInstrumentations = {
    http: 0,
    graphql: 0,
    mongodb: 0,
    webrtc: 0
  }
  
  let totalSamplingRate = 0

  for (const user of usersWithInstrumentation) {
    const config = user.instrumentationConfig as UserInstrumentationConfig
    
    // Determine which preset this config matches
    let matchedPreset = 'custom'
    for (const [presetName, preset] of Object.entries(INSTRUMENTATION_PRESETS)) {
      if (JSON.stringify(config) === JSON.stringify(preset.config)) {
        matchedPreset = presetName
        break
      }
    }
    
    presetDistribution[matchedPreset] = (presetDistribution[matchedPreset] || 0) + 1
    totalSamplingRate += config.samplingRate
    
    // Count enabled instrumentations
    Object.entries(config.instrumentations).forEach(([key, enabled]) => {
      if (enabled && key in enabledInstrumentations) {
        enabledInstrumentations[key as keyof typeof enabledInstrumentations]++
      }
    })
  }

  return {
    totalUsers,
    usersWithConfig,
    presetDistribution,
    averageSamplingRate: usersWithConfig > 0 ? totalSamplingRate / usersWithConfig : 0,
    enabledInstrumentations
  }
}

/**
 * Get users with specific instrumentation settings (for monitoring high-volume users)
 */
export async function getUsersWithHighInstrumentation(): Promise<Array<{
  userId: string
  email: string
  samplingRate: number
  verbosityLevel: string
  enabledInstrumentations: string[]
  estimatedDataVolume: string
}>> {
  const usersCollection = await getCollection('users')
  
  const highInstrumentationUsers = await usersCollection.find({
    $or: [
      { 'instrumentationConfig.samplingRate': { $gte: 0.5 } },
      { 'instrumentationConfig.verbosityLevel': 'DETAILED' },
      { 'instrumentationConfig.instrumentations.webrtc': true },
      { 'instrumentationConfig.instrumentations.mongodb': true }
    ]
  }, {
    projection: { _id: 1, email: 1, instrumentationConfig: 1 }
  }).toArray()

  return highInstrumentationUsers.map((user: any) => {
    const config = user.instrumentationConfig as UserInstrumentationConfig
    const enabledInstrumentations = Object.entries(config.instrumentations)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
    
    // Estimate data volume per hour
    let volumeEstimate = 'Unknown'
    if (config.samplingRate >= 0.8 && config.verbosityLevel === 'DETAILED') {
      volumeEstimate = '2-5MB/hour'
    } else if (config.samplingRate >= 0.5) {
      volumeEstimate = '500KB-1MB/hour'
    } else if (config.samplingRate >= 0.2) {
      volumeEstimate = '200-500KB/hour'
    } else {
      volumeEstimate = '<200KB/hour'
    }

    return {
      userId: user._id,
      email: user.email,
      samplingRate: config.samplingRate,
      verbosityLevel: config.verbosityLevel,
      enabledInstrumentations,
      estimatedDataVolume: volumeEstimate
    }
  })
}

/**
 * Reset instrumentation config for a user to default
 */
export async function resetUserInstrumentationConfig(userId: string): Promise<void> {
  const usersCollection = await getCollection('users')
  
  await usersCollection.updateOne(
    { _id: new ObjectId(userId) },
    { 
      $unset: { instrumentationConfig: 1 },
      $set: { updatedAt: Date.now() }
    }
  )
  
  clearUserConfigCache(userId)
  console.log(`Reset instrumentation config for user ${userId} to default`)
}

/**
 * Batch reset multiple users to default configuration
 */
export async function batchResetInstrumentationConfigs(userIds: string[]): Promise<{ reset: number; errors: string[] }> {
  const usersCollection = await getCollection('users')
  const errors: string[] = []
  let reset = 0

  for (const userId of userIds) {
    try {
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { 
          $unset: { instrumentationConfig: 1 },
          $set: { updatedAt: Date.now() }
        }
      )
      clearUserConfigCache(userId)
      reset++
    } catch (error) {
      errors.push(`Failed to reset config for user ${userId}: ${error}`)
    }
  }

  return { reset, errors }
}

/**
 * Clear all instrumentation config caches (useful after bulk operations)
 */
export function clearInstrumentationCaches(): void {
  clearAllConfigCache()
  console.log('Cleared all instrumentation config caches')
}

/**
 * Create a temporary high-instrumentation session for a user (auto-expires)
 */
export async function createTemporaryInstrumentationSession(
  userId: string, 
  durationMinutes: number = 30,
  config: Partial<UserInstrumentationConfig> = INSTRUMENTATION_PRESETS.debug.config
): Promise<void> {
  // Apply the temporary config
  await updateUserInstrumentationConfig(userId, config)
  
  // Schedule reset back to default (in a real implementation, you'd use a job queue)
  setTimeout(async () => {
    try {
      await resetUserInstrumentationConfig(userId)
      console.log(`Temporary instrumentation session expired for user ${userId}`)
    } catch (error) {
      console.error(`Failed to reset temporary session for user ${userId}:`, error)
    }
  }, durationMinutes * 60 * 1000)
  
  console.log(`Created temporary high-instrumentation session for user ${userId} (${durationMinutes} minutes)`)
}

/**
 * Helper function to validate instrumentation configuration
 */
export function validateInstrumentationConfig(config: Partial<UserInstrumentationConfig>): string[] {
  const errors: string[] = []
  
  if (config.samplingRate !== undefined) {
    if (config.samplingRate < 0 || config.samplingRate > 1) {
      errors.push('samplingRate must be between 0 and 1')
    }
  }
  
  if (config.verbosityLevel !== undefined) {
    if (!['MINIMAL', 'STANDARD', 'DETAILED'].includes(config.verbosityLevel)) {
      errors.push('verbosityLevel must be MINIMAL, STANDARD, or DETAILED')
    }
  }
  
  return errors
}