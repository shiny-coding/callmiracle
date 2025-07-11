import logger, { withContext } from './logger'
import type { NextApiRequest, NextApiResponse } from 'next'

// Custom application error class
export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly isOperational: boolean
  
  constructor(
    message: string, 
    statusCode: number = 500, 
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    this.name = this.constructor.name
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor)
  }
}

// Predefined error types
export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR')
    if (field) {
      this.message = `${field}: ${message}`
    }
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR')
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR')
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR')
  }
}

// Error response interface
interface ErrorResponse {
  statusCode: number
  code: string
  message: string
  details?: any
}

// Handle and log errors with context
export const handleError = (
  error: Error | AppError, 
  req?: NextApiRequest,
  additionalContext?: Record<string, any>
): ErrorResponse => {
  
  // Create logger with request context if available
  const log = req ? 
    withContext({
      requestId: (req.headers['x-request-id'] as string) || 'no-request-id',
      userId: (req as any).session?.user?.id || 'anonymous',
      path: req.url || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown'
    }) :
    logger
  
  if (error instanceof AppError) {
    // Known application error
    const logLevel = error.statusCode >= 500 ? 'error' : 'warn'
    
    log[logLevel](`${error.code}: ${error.message}`, {
      statusCode: error.statusCode,
      code: error.code,
      stack: error.stack,
      isOperational: error.isOperational,
      ...additionalContext
    })
    
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    }
  }
  
  // Unknown/system error
  log.error(`Unhandled error: ${error.message}`, {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...additionalContext
  })
  
  // Don't expose internal error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message
  
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message
  }
}

// Async error wrapper for API routes
export const asyncHandler = (fn: Function) => {
  return (req: NextApiRequest, res: any, next?: Function) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      const errorResponse = handleError(error, req)
      res.status(errorResponse.statusCode).json(errorResponse)
    })
  }
}

// GraphQL error formatter
export const formatGraphQLError = (error: any) => {
  // Log the error
  logger.error('GraphQL Error', {
    message: error.message,
    locations: error.locations,
    path: error.path,
    stack: error.stack
  })
  
  // Format for client
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      extensions: {
        code: error.code,
        statusCode: error.statusCode
      }
    }
  }
  
  // For unknown errors, don't expose details in production
  return {
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    code: 'INTERNAL_ERROR',
    extensions: {
      code: 'INTERNAL_ERROR'
    }
  }
}

// Database operation error handler
export const handleDatabaseError = (error: any, operation: string, collection?: string) => {
  // MongoDB specific errors
  if (error.code === 11000) {
    throw new ConflictError('Duplicate key error')
  }
  
  if (error.name === 'ValidationError') {
    throw new ValidationError(error.message)
  }
  
  if (error.name === 'CastError') {
    throw new ValidationError('Invalid ID format')
  }
  
  // Log and throw generic error
  logger.error('Database operation failed', {
    operation,
    collection,
    error: error.message,
    stack: error.stack
  })
  
  throw new AppError('Database operation failed')
}

// Performance monitoring wrapper
export const withPerformanceLogging = (name: string, fn: Function) => {
  return async (...args: any[]) => {
    const start = Date.now()
    
    try {
      const result = await fn(...args)
      const duration = Date.now() - start
      
      const logLevel = duration > 1000 ? 'warn' : 'info'
      logger[logLevel](`Performance: ${name}`, { duration, name, type: 'performance' })
      
      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.error(`Performance: ${name} failed`, { 
        duration, 
        name, 
        type: 'performance',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
} 