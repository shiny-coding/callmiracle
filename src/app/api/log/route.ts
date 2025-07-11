import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import logger, { withContext } from '@/utils/logger'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const requestId = uuidv4()
    
    // Get request body
    const { level, message, meta } = await request.json()
    
    if (!level || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: level, message' },
        { status: 400 }
      )
    }
    
    // Validate log level
    const validLevels = ['debug', 'info', 'warn', 'error']
    if (!validLevels.includes(level)) {
      return NextResponse.json(
        { error: 'Invalid log level' },
        { status: 400 }
      )
    }
    
    // Create context for the log
    const context = {
      requestId,
      userId: session?.user?.id || 'anonymous',
      path: '/api/log',
      userAgent: request.headers.get('user-agent') || 'unknown',
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown'
    }
    
    const contextLogger = withContext(context)
    
    // Log the client message with additional context
    const enrichedMeta = {
      ...meta,
      source: 'client',
      clientTimestamp: meta?.timestamp,
      serverTimestamp: new Date().toISOString()
    }
    
    // Use the appropriate log level
    switch (level) {
      case 'debug':
        contextLogger.debug(`[CLIENT] ${message}`, enrichedMeta)
        break
      case 'info':
        contextLogger.info(`[CLIENT] ${message}`, enrichedMeta)
        break
      case 'warn':
        contextLogger.warn(`[CLIENT] ${message}`, enrichedMeta)
        break
      case 'error':
        contextLogger.error(`[CLIENT] ${message}`, enrichedMeta)
        break
    }
    
    return NextResponse.json({ success: true }, { status: 200 })
    
  } catch (error) {
    // Log the error but don't expose internal details
    logger.error('Error processing client log', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
} 