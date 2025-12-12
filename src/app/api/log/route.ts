import { NextRequest, NextResponse } from 'next/server'
import { getLogger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  try {
    // Get logger from AsyncLocalStorage context - same pattern as server routes
    const logger = await getLogger()
    
    // Get request body
    const { level, message, section, meta } = await request.json()

    if (!level || !message) {
      logger.warn('Client log request missing required fields', {
        hasLevel: !!level,
        hasMessage: !!message
      })
      return NextResponse.json(
        { error: 'Missing required fields: level, message' },
        { status: 400 }
      )
    }

    // Validate log level
    const validLevels = ['debug', 'info', 'warn', 'error']
    if (!validLevels.includes(level)) {
      logger.warn('Client log request with invalid log level', {
        level,
        validLevels
      })
      return NextResponse.json(
        { error: 'Invalid log level' },
        { status: 400 }
      )
    }

    // Format section name for display (e.g., 'pushNotifications' -> 'PushNotifications')
    // Handle non-string values gracefully (old clients might send objects or undefined)
    const formatSectionName = (s: unknown): string => {
      if (typeof s === 'string' && s.length > 0) {
        return s.charAt(0).toUpperCase() + s.slice(1)
      }
      return 'Unknown'
    }
    const sectionLabel = `[${formatSectionName(section)}]`

    // Enrich metadata with section as a separate field for Loki filtering
    // Note: Logger context already captures IP from request
    // Note: Message has [CLIENT] prefix for identification
    // Note: userAgent already in meta from client
    // Note: Loki adds its own ingestion timestamp
    const enrichedMeta = {
      ...meta,
      section: section || 'unknown' // Add section as filterable field
    }

    // Log using the same pattern as server-side, but with [CLIENT][Section] prefix
    const logMethod = logger[level as keyof typeof logger]
    if (typeof logMethod === 'function') {
      logMethod(`[CLIENT] ${sectionLabel} ${message}`, enrichedMeta)
    }
    
    return NextResponse.json({ success: true }, { status: 200 })
    
  } catch (error) {
    // Use the same logger for error handling
    const logger = await getLogger()
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