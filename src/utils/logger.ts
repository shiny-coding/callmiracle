import { createLogger, format, transports } from 'winston'
import 'winston-daily-rotate-file'
import path from 'path'
import type { NextApiRequest } from 'next'
import { getRequestContext } from './requestContext'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// Define log directory and ensure it exists
const logDir = process.env.LOG_DIR || 'logs'

export const defaultLogLevel = 'info'
export const defaultClientLogLevel = 'warn'

// Define custom log format for better readability
const logFormat = format.printf(({ level, message, timestamp, service, requestId, userId, userName, path: reqPath, ...metadata }) => {
  let baseLog = `${timestamp} [${level.toUpperCase()}]`
  
  // Add service context
  if (service) {
    baseLog += ` [${service}]`
  }
  
  // Add request context if available
  if (requestId) {
    baseLog += ` [${requestId}]`
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
  
  baseLog += `: ${message}`
  
  // Include additional metadata as JSON if present
  const metaKeys = Object.keys(metadata)
  if (metaKeys.length > 0) {
    baseLog += ` ${JSON.stringify(metadata)}`
  }
  
  return baseLog
})

// Create base transports array
const logTransports: any[] = [
  // Console transport for development
  new transports.Console({
    format: format.combine(
      format.colorize(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    ),
    silent: process.env.NODE_ENV === 'test'
  }),
  
  // Rotating file transport for all logs
  new transports.DailyRotateFile({
    filename: path.join(logDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.json()
    )
  }),
  
  // Separate error log
  new transports.DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    zippedArchive: true,
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.json()
    )
  })
]

// Function to add Elasticsearch transport asynchronously (optional)
const addElasticsearchTransport = async () => {
  if (process.env.ELASTICSEARCH_URL && process.env.NODE_ENV === 'production') {
    try {
      // Dynamic import for optional dependency
      const { ElasticsearchTransport } = await import('winston-elasticsearch')
      
      const esTransport = new ElasticsearchTransport({
        level: 'info',
        clientOpts: { 
          node: process.env.ELASTICSEARCH_URL,
          auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
            username: process.env.ELASTICSEARCH_USERNAME,
            password: process.env.ELASTICSEARCH_PASSWORD
          } : undefined
        },
        indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'callmiracle',
        indexSuffixPattern: 'YYYY.MM.DD',
        transformer: (logData: any) => {
          // Transform the log data for better Elasticsearch indexing
          return {
            '@timestamp': new Date().toISOString(),
            level: logData.level,
            message: logData.message,
            service: logData.meta?.service || 'callmiracle',
            requestId: logData.meta?.requestId,
            userId: logData.meta?.userId,
            userName: logData.meta?.userName,
            userLogLevel: logData.meta?.userLogLevel,
            path: logData.meta?.path,
            metadata: logData.meta
          }
        }
      })
      
      logger.add(esTransport)
      console.log('Elasticsearch logging transport enabled')
    } catch (error) {
      console.warn('Elasticsearch transport not available:', (error as Error).message)
    }
  }
}

// Create the logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true })
  ),
  defaultMeta: { service: 'main' },
  transports: logTransports,
  // Don't exit on handled exceptions
  exitOnError: false
})

// Initialize Elasticsearch transport asynchronously if configured
addElasticsearchTransport().catch((error) => {
  console.warn('Failed to initialize Elasticsearch transport:', (error as Error).message)
})

// Handle uncaught exceptions and unhandled rejections
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new transports.DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  )
  
  logger.rejections.handle(
    new transports.DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  )
}

// Context logger for requests
interface LogContext {
  requestId?: string
  userId?: string
  userName?: string
  userLogLevel?: string
  path?: string
  userAgent?: string
  ip?: string
}

// Helper function to check if a log level should be logged
function shouldLog(userLogLevel: string, currentLevel: string): boolean {
  const levels = ['debug', 'info', 'warn', 'error']
  const userIndex = levels.indexOf(userLogLevel)
  const currentIndex = levels.indexOf(currentLevel)
  return currentIndex >= userIndex
}

// Enhanced context logger that can work with centralized request context
export const withRequestContext = (context: LogContext) => {
  return withContext(context)
}

export const withContext = (context: LogContext) => {
  const userLogLevel = context.userLogLevel || defaultLogLevel
  
  return {
    debug: (message: string, meta: object = {}) => {
      if (shouldLog(userLogLevel, 'debug')) {
        logger.debug(message, { ...context, ...meta })
      }
    },
    info: (message: string, meta: object = {}) => {
      if (shouldLog(userLogLevel, 'info')) {
        logger.info(message, { ...context, ...meta })
      }
    },
    warn: (message: string, meta: object = {}) => {
      if (shouldLog(userLogLevel, 'warn')) {
        logger.warn(message, { ...context, ...meta })
      }
    },
    error: (message: string, meta: object = {}) => {
      if (shouldLog(userLogLevel, 'error')) {
        logger.error(message, { ...context, ...meta })
      }
    }
  }
}

// Request logger helper (legacy - for old Pages API)
export const withRequest = (req: NextApiRequest) => {
  const context: LogContext = {
    requestId: (req.headers['x-request-id'] as string) || 'no-request-id',
    path: req.url,
    userAgent: req.headers['user-agent'],
    ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown'
  }
  
  // Try to get user ID from session if available
  try {
    const session = (req as any).session
    if (session?.user?.id) {
      context.userId = session.user.id
    }
  } catch (error) {
    // Session not available, that's ok
  }
  
  return withContext(context)
}

/**
 * Unified logger function that automatically gets request context and session context
 * This is the primary function API routes should use - no need to manually create context
 * 
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const logger = await getLogger() // Gets context from AsyncLocalStorage
 *   logger.info('Processing request')
 * }
 * ```
 */
export async function getLogger(request?: Request) {
  // Get request context from AsyncLocalStorage
  const requestContext = getRequestContext()

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
    userLogLevel: session?.user?.logLevel || defaultLogLevel
  })

  return logger
}

export default logger
