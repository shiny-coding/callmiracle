import { createLogger, format, transports } from 'winston'
import 'winston-daily-rotate-file'
import LokiTransport from 'winston-loki'
import path from 'path'
import type { NextApiRequest } from 'next'
import { getRequestContext } from './requestContext'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { trace } from '@opentelemetry/api'

// Define log directory and ensure it exists
const logDir = process.env.LOG_DIR || 'logs'

export const defaultLogLevel = 'info'

// ANSI color codes
const colors = {
  gray: '\x1b[90m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

// Create log format function with options
function createLogFormat(colorize: boolean = false, fullDates: boolean = true) {
  return format.printf(({ level, message, timestamp, userAgent, service, userLogLevel, requestId, userId, userName, path: reqPath, ...metadata }) => {
    // Handle timestamp formatting
    let logTimestamp = (timestamp as string) || new Date().toISOString().replace('T', ' ').substring(0, 19)
    
    if (!fullDates) {
      const today = new Date().toISOString().substring(0, 10) // YYYY-MM-DD
      const timestampDate = logTimestamp.substring(0, 10)
      
      if (timestampDate === today) {
        // For today's logs, show only time (HH:mm:ss)
        logTimestamp = logTimestamp.substring(11, 19)
      }
    }
    
    // Get current trace ID for correlation
    const span = trace.getActiveSpan()
    const traceId = span?.spanContext().traceId || 'no-trace'
    
    // Handle level colorization
    let levelStr = `[${level.toUpperCase()}]`
    if (colorize) {
      switch (level.toLowerCase()) {
        case 'error':
          levelStr = `${colors.red}${levelStr}${colors.reset}`
          break
        case 'warn':
          levelStr = `${colors.yellow}${levelStr}${colors.reset}`
          break
        case 'info':
          levelStr = `${colors.green}${levelStr}${colors.reset}`
          break
        case 'debug':
          levelStr = `${colors.blue}${levelStr}${colors.reset}`
          break
      }
    }
    
    let baseLog = `${logTimestamp} ${levelStr}`
    
    // Add trace ID for correlation
    if (traceId !== 'no-trace') {
      const traceIdStr = colorize ? `${colors.gray}[trace:${traceId}]${colors.reset}` : `[trace:${traceId}]`
      baseLog += ` ${traceIdStr}`
    }
    
    // Add user context if available
    if (userId && userId !== 'anonymous') {
      if (userName && userName !== 'anonymous') {
        baseLog += ` [user:${userName}(${userId})]`
      } else {
        baseLog += ` [user:${userId}]`
      }
    }
    
    // Add path if available
    if (reqPath) {
      baseLog += ` [${reqPath}]`
    }
    
    // Add request ID if available
    if (requestId) {
      const requestIdStr = colorize ? `${colors.gray}[req:${requestId}]${colors.reset}` : `[req:${requestId}]`
      baseLog += ` ${requestIdStr}`
    }
    
    // Add service if available
    if (service) {
      const serviceStr = colorize ? `${colors.gray}[${service}]${colors.reset}` : `[${service}]`
      baseLog += ` ${serviceStr}`
    }
    
    baseLog += `:\n${message}`
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      const filteredMeta = Object.fromEntries(
        Object.entries(metadata).filter(([key]) => 
          !['timestamp', 'level', 'message', 'userAgent', 'service', 'userLogLevel', 'requestId', 'userId', 'userName', 'path'].includes(key)
        )
      )
      if (Object.keys(filteredMeta).length > 0) {
        baseLog += ` ${JSON.stringify(filteredMeta)}`
      }
    }
    
    return baseLog
  })
}

// Create Loki format for structured logs
const lokiFormat = format.combine(
  format.timestamp(),
  format.json(),
  format.printf(({ timestamp, level, message, service, userId, userName, requestId, path: reqPath, ...metadata }) => {
    const span = trace.getActiveSpan()
    const traceId = span?.spanContext().traceId || undefined
    
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: service || 'callmiracle',
      userId,
      userName,
      requestId,
      path: reqPath,
      traceId,
      ...metadata
    })
  })
)

// Create the main logger instance
const logger = createLogger({
  level: defaultLogLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    createLogFormat(false, true) // Non-colorized, full dates for main logger
  ),
  transports: [
    // Console transport for development (colorized, short dates)
    new transports.Console({
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        createLogFormat(true, false) // Colorized, short dates for console
      )
    }),
    
    // File transport for all logs (non-colorized, full dates)
    new transports.DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        createLogFormat(false, true) // Non-colorized, full dates for files
      )
    }),
    
    // Separate file for errors (non-colorized, full dates)
    new transports.DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        createLogFormat(false, true) // Non-colorized, full dates for files
      )
    }),
    
    // Loki transport for log aggregation (only in production or when explicitly enabled)
    ...(process.env.NODE_ENV === 'production' || process.env.ENABLE_LOKI === 'true' ? [
      new LokiTransport({
        host: process.env.LOKI_HOST || 'http://localhost:3100',
        labels: { 
          app: 'callmiracle',
          environment: process.env.NODE_ENV || 'development',
          service: 'main'
        },
        json: true,
        format: lokiFormat,
        replaceTimestamp: true,
        onConnectionError: (err) => {
          console.error('Loki connection error:', err)
        }
      })
    ] : [])
  ]
})

interface LogContext {
  requestId?: string
  userId?: string
  userName?: string
  userLogLevel?: string
  path?: string
  userAgent?: string
  ip?: string
  service?: string
}

function shouldLog(userLogLevel: string, messageLevel: string): boolean {
  const levels = ['error', 'warn', 'info', 'debug']
  const userLevelIndex = levels.indexOf(userLogLevel)
  const messageLevelIndex = levels.indexOf(messageLevel)
  
  return messageLevelIndex <= userLevelIndex
}

export const withContext = (context: LogContext) => {
  return {
    debug: (message: string, meta?: any) => {
      if (shouldLog(context.userLogLevel || defaultLogLevel, 'debug')) {
        logger.debug(message, { ...context, ...meta })
      }
    },
    info: (message: string, meta?: any) => {
      if (shouldLog(context.userLogLevel || defaultLogLevel, 'info')) {
        logger.info(message, { ...context, ...meta })
      }
    },
    warn: (message: string, meta?: any) => {
      if (shouldLog(context.userLogLevel || defaultLogLevel, 'warn')) {
        logger.warn(message, { ...context, ...meta })
      }
    },
    error: (message: string, meta?: any) => {
      if (shouldLog(context.userLogLevel || defaultLogLevel, 'error')) {
        logger.error(message, { ...context, ...meta })
      }
    }
  }
}

// Export the base logger for direct use
export { logger }

/**
 * Unified logger function that automatically gets request context from headers and session context
 * This is the primary function API routes should use
 * 
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const logger = await getLogger()
 *   logger.info('Processing request')
 * }
 * ```
 */
export async function getLogger() {
  // Get request context from headers (set by middleware)
  const requestContext = await getRequestContext()

  // Get session context (userId, userName, userLogLevel)
  const session = await getServerSession(authOptions)
  
  // Create logger with full context
  const logger = withContext({
    requestId: requestContext.requestId,
    path: requestContext.path,
    userAgent: requestContext.userAgent,
    ip: requestContext.ip,
    userId: session?.user?.id || 'anonymous',
    userName: session?.user?.name || 'anonymous',
    userLogLevel: (session?.user as any)?.logLevel || defaultLogLevel,
    service: 'main'
  })

  return logger
}

// Helper function to add trace context to logs
export function addTraceToLog(meta: any = {}) {
  const span = trace.getActiveSpan()
  if (span) {
    const spanContext = span.spanContext()
    return {
      ...meta,
      traceId: spanContext.traceId,
      spanId: spanContext.spanId
    }
  }
  return meta
}
