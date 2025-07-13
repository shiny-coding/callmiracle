import type { NextApiRequest, NextApiResponse } from 'next'
import { v4 as uuidv4 } from 'uuid'
import { getLogger, withContext } from '@/utils/logger'

// Extend NextApiRequest to include our custom properties
interface ExtendedRequest extends NextApiRequest {
  requestId?: string
  startTime?: number
}

// Request logging middleware
export async function requestLogger(
  req: ExtendedRequest,
  res: NextApiResponse,
  next: () => void
) {
  // Create logger with request context
  const log = await getLogger()
  
  // Determine if we should log the body (avoid logging sensitive data)
  const shouldLogBody = !req.url?.includes('/auth/') && 
                       !req.url?.includes('/password') &&
                       req.method !== 'GET'
  
  // Log the incoming request
  const requestLog: any = {
    method: req.method,
    url: req.url,
    query: req.query,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    contentLength: req.headers['content-length'],
    contentType: req.headers['content-type']
  }
  
  // Add body for non-sensitive routes
  if (shouldLogBody && req.body) {
    // Redact sensitive fields
    const sanitizedBody = sanitizeRequestBody(req.body)
    requestLog.body = sanitizedBody
  }
  
  log.info(`Incoming request: ${req.method} ${req.url}`, requestLog)
  
  // Override res.end to log when the request completes
  const originalEnd = res.end
  const originalWrite = res.write
  let responseBody = ''
  
  // Capture response body for logging (limit size)
  ;(res as any).write = function(chunk: any, ...args: any[]) {
    if (chunk && responseBody.length < 1000) { // Limit to 1KB
      responseBody += chunk.toString()
    }
    // eslint-disable-next-line prefer-rest-params
    return originalWrite.apply(res, arguments as any)
  }
  
  ;(res as any).end = function(chunk?: any, ...args: any[]) {
    const responseTime = Date.now() - (req.startTime || Date.now())
    
    // Capture final chunk
    if (chunk && responseBody.length < 1000) {
      responseBody += chunk.toString()
    }
    
    // Determine log level based on status code
    const logLevel = res.statusCode >= 500 ? 'error' : 
                    res.statusCode >= 400 ? 'warn' : 'info'
    
    const responseLog: any = {
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.getHeader('content-length'),
      contentType: res.getHeader('content-type')
    }
    
    // Add response body for errors or if explicitly enabled
    if (res.statusCode >= 400 || process.env.LOG_RESPONSE_BODY === 'true') {
      try {
        // Try to parse as JSON for better formatting
        const parsed = JSON.parse(responseBody)
        responseLog.body = parsed
      } catch {
        // Not JSON, log as string (truncated)
        if (responseBody) {
          responseLog.body = responseBody.substring(0, 500)
        }
      }
    }
    
    // Use the log instance with the correct level
    if (logLevel === 'error') {
      log.error(`Response: ${req.method} ${req.url} - ${res.statusCode}`, responseLog);
    } else if (logLevel === 'warn') {
      log.warn(`Response: ${req.method} ${req.url} - ${res.statusCode}`, responseLog);
    } else {
      log.info(`Response: ${req.method} ${req.url} - ${res.statusCode}`, responseLog);
    }
    
    // Call original end
    // eslint-disable-next-line prefer-rest-params
    return originalEnd.apply(res, arguments as any)
  }
  
  next()
}

// Sanitize request body to remove sensitive information
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body
  }
  
  const sensitiveFields = [
    'password',
    'secret',
    'token',
    'key',
    'auth',
    'credentials',
    'authorization'
  ]
  
  const sanitized = { ...body }
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }
  
  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeRequestBody(sanitized[key])
    }
  }
  
  return sanitized
}

// Wrapper function to easily apply the middleware
export function withRequestLogging(handler: Function) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    await requestLogger(req as ExtendedRequest, res, () => {
      handler(req, res)
    })
  }
} 