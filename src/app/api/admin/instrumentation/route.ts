import { NextRequest, NextResponse } from 'next/server'
import { getLogger } from '@/utils/logger'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import {
  applyInstrumentationPreset,
  bulkApplyInstrumentationPreset,
  getInstrumentationStats,
  getUsersWithHighInstrumentation,
  resetUserInstrumentationConfig,
  batchResetInstrumentationConfigs,
  clearInstrumentationCaches,
  createTemporaryInstrumentationSession,
  validateInstrumentationConfig,
  INSTRUMENTATION_PRESETS
} from '@/utils/admin-instrumentation'
import { updateUserInstrumentationConfig } from '@/utils/user-instrumentation'

// This endpoint requires admin access - you should implement proper admin authentication
async function checkAdminAccess(request: NextRequest): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return false
  }

  // Check if user is admin (implement your admin check logic here)
  // For now, checking if email contains 'admin' - replace with your actual logic
  const isAdmin = session.user.email?.includes('admin') || 
                  session.user.email?.includes('dev') ||
                  session.user.email?.includes('support')
  
  return Boolean(isAdmin)
}

export async function GET(request: NextRequest) {
  const logger = await getLogger()
  
  try {
    if (!(await checkAdminAccess(request))) {
      logger.warn('Unauthorized access attempt to admin instrumentation API')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'stats':
        const stats = await getInstrumentationStats()
        logger.info('Retrieved instrumentation statistics', { stats })
        return NextResponse.json({ success: true, data: stats })

      case 'high-volume-users':
        const highVolumeUsers = await getUsersWithHighInstrumentation()
        logger.info('Retrieved high-volume instrumentation users', { count: highVolumeUsers.length })
        return NextResponse.json({ success: true, data: highVolumeUsers })

      case 'presets':
        logger.info('Retrieved instrumentation presets')
        return NextResponse.json({ success: true, data: INSTRUMENTATION_PRESETS })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    logger.error('Error in admin instrumentation GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const logger = await getLogger()
  
  try {
    if (!(await checkAdminAccess(request))) {
      logger.warn('Unauthorized access attempt to admin instrumentation API')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { action, userId, userIds, presetName, config, criteria, durationMinutes } = body

    switch (action) {
      case 'apply-preset':
        if (!userId || !presetName) {
          return NextResponse.json({ error: 'userId and presetName required' }, { status: 400 })
        }
        await applyInstrumentationPreset(userId, presetName)
        logger.info('Applied instrumentation preset', { userId, presetName })
        return NextResponse.json({ success: true, message: `Applied ${presetName} preset to user ${userId}` })

      case 'bulk-apply-preset':
        if (!presetName || !criteria) {
          return NextResponse.json({ error: 'presetName and criteria required' }, { status: 400 })
        }
        const bulkResult = await bulkApplyInstrumentationPreset(presetName, criteria)
        logger.info('Bulk applied instrumentation preset', { presetName, criteria, result: bulkResult })
        return NextResponse.json({ success: true, data: bulkResult })

      case 'update-config':
        if (!userId || !config) {
          return NextResponse.json({ error: 'userId and config required' }, { status: 400 })
        }
        
        // Validate config
        const validationErrors = validateInstrumentationConfig(config)
        if (validationErrors.length > 0) {
          return NextResponse.json({ error: 'Invalid config', details: validationErrors }, { status: 400 })
        }
        
        await updateUserInstrumentationConfig(userId, config)
        logger.info('Updated user instrumentation config', { userId, config })
        return NextResponse.json({ success: true, message: `Updated config for user ${userId}` })

      case 'reset-config':
        if (!userId) {
          return NextResponse.json({ error: 'userId required' }, { status: 400 })
        }
        await resetUserInstrumentationConfig(userId)
        logger.info('Reset user instrumentation config', { userId })
        return NextResponse.json({ success: true, message: `Reset config for user ${userId}` })

      case 'batch-reset':
        if (!userIds || !Array.isArray(userIds)) {
          return NextResponse.json({ error: 'userIds array required' }, { status: 400 })
        }
        const resetResult = await batchResetInstrumentationConfigs(userIds)
        logger.info('Batch reset instrumentation configs', { userIds, result: resetResult })
        return NextResponse.json({ success: true, data: resetResult })

      case 'clear-caches':
        clearInstrumentationCaches()
        logger.info('Cleared instrumentation caches')
        return NextResponse.json({ success: true, message: 'Cleared all instrumentation caches' })

      case 'create-temp-session':
        if (!userId) {
          return NextResponse.json({ error: 'userId required' }, { status: 400 })
        }
        await createTemporaryInstrumentationSession(userId, durationMinutes, config)
        logger.info('Created temporary instrumentation session', { userId, durationMinutes })
        return NextResponse.json({ 
          success: true, 
          message: `Created temporary session for user ${userId} (${durationMinutes || 30} minutes)` 
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    logger.error('Error in admin instrumentation POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const logger = await getLogger()
  
  try {
    if (!(await checkAdminAccess(request))) {
      logger.warn('Unauthorized access attempt to admin instrumentation API')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    await resetUserInstrumentationConfig(userId)
    logger.info('Deleted user instrumentation config', { userId })
    return NextResponse.json({ success: true, message: `Deleted config for user ${userId}` })
  } catch (error) {
    logger.error('Error in admin instrumentation DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}