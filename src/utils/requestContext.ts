import { NextRequest } from 'next/server'
import { headers } from 'next/headers'

export interface RequestContext {
  requestId: string
  path: string
  method: string
  timestamp: string
  userAgent?: string
  ip?: string
}

/**
 * Generate a short 4-character request ID for easier reading
 * This matches the middleware implementation
 */
export function generateShortRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Get the current request context from headers (set by middleware)
 * This can be called from anywhere within the request lifecycle
 */
export async function getRequestContext(): Promise<RequestContext> {
  try {
    const headersList = await headers()
    
    return {
      requestId: headersList.get('x-request-id') || 'unknown',
      path: headersList.get('x-request-path') || 'unknown',
      method: headersList.get('x-request-method') || 'unknown',
      timestamp: headersList.get('x-request-timestamp') || Date.now().toString(),
      userAgent: headersList.get('x-request-user-agent') || undefined,
      ip: headersList.get('x-request-ip') || undefined
    }
  } catch (error) {
    // Fallback context for when called outside of request scope
    return {
      requestId: 'unknown',
      path: 'unknown',
      method: 'unknown',
      timestamp: Date.now().toString(),
      userAgent: undefined,
      ip: undefined
    }
  }
}

/**
 * Extract request context from NextRequest object
 * Use this in middleware to create the initial context
 */
export function extractRequestContext(request: NextRequest): RequestContext {
  return {
    requestId: generateShortRequestId(),
    path: request.nextUrl.pathname,
    method: request.method,
    timestamp: Date.now().toString(),
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        request.headers.get('x-client-ip') || 
        undefined
  }
}
