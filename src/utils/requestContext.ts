import { AsyncLocalStorage } from 'node:async_hooks'
import { NextRequest } from 'next/server'

export interface RequestContext {
  requestId: string
  path: string
  method: string
  timestamp: string
  userAgent?: string
  ip?: string
}

// Create AsyncLocalStorage instance for request context
const requestContextStorage = new AsyncLocalStorage<RequestContext>()

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
 * Set request context for the current async execution
 * This should be called from middleware with the request context
 */
export function setRequestContext(context: RequestContext): void {
  // Note: This should only be called from within an AsyncLocalStorage.run() context
  const store = requestContextStorage.getStore()
  if (!store) {
    throw new Error('setRequestContext must be called within an AsyncLocalStorage context')
  }
  
  // Update the store with new context
  Object.assign(store, context)
}

/**
 * Get the current request context from AsyncLocalStorage
 * This can be called from anywhere within the request lifecycle
 */
export function getRequestContext(): RequestContext {
  const context = requestContextStorage.getStore()
  if (!context) {
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
  return context
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

/**
 * Run a function with request context using AsyncLocalStorage
 * This should be called from middleware
 */
export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return requestContextStorage.run(context, fn)
}

/**
 * Get request context with fallback for when AsyncLocalStorage isn't available
 * This is useful for GraphQL routes or other scenarios
 */
export function getRequestContextWithFallback(request?: Request): RequestContext {
  const context = requestContextStorage.getStore()
  if (context) {
    return context
  }
  
  // Fallback: create minimal context if AsyncLocalStorage isn't available
  if (request) {
    return {
      requestId: generateShortRequestId(),
      path: new URL(request.url).pathname,
      method: request.method,
      timestamp: Date.now().toString(),
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          request.headers.get('x-client-ip') || 
          undefined
    }
  }
  
  return {
    requestId: 'unknown',
    path: 'unknown',
    method: 'unknown',
    timestamp: Date.now().toString(),
    userAgent: undefined,
    ip: undefined
  }
}
