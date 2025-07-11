'use client'

// Client-side logger that can optionally send logs to server
interface LogMeta {
  [key: string]: any
}

class ClientLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isEnabled = typeof window !== 'undefined'
  
  private formatMessage(level: string, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`
  }
  
  private sendToServer = async (level: string, message: string, meta: LogMeta = {}) => {
    if (!this.isEnabled) return
    
    try {
      // Only send errors and warnings to server by default
      // Can be configured via environment variable
      const shouldSend = level === 'error' || 
                        level === 'warn' || 
                        process.env.NEXT_PUBLIC_CLIENT_LOGGING === 'true'
      
      if (shouldSend) {
        fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            level, 
            message, 
            meta: {
              ...meta,
              url: window.location.href,
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString()
            }
          })
        }).catch(() => {
          // Silent fail for logging - don't spam console
        })
      }
    } catch (error) {
      // Silent fail for logging
    }
  }
  
  debug = (message: string, meta: LogMeta = {}) => {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, meta))
    }
    // Don't send debug logs to server by default
  }
  
  info = (message: string, meta: LogMeta = {}) => {
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message, meta))
    }
    
    // Send to server if explicitly enabled
    if (process.env.NEXT_PUBLIC_CLIENT_LOGGING === 'true') {
      this.sendToServer('info', message, meta)
    }
  }
  
  warn = (message: string, meta: LogMeta = {}) => {
    if (this.isDevelopment) {
      console.warn(this.formatMessage('warn', message, meta))
    }
    
    // Always send warnings to server
    this.sendToServer('warn', message, meta)
  }
  
  error = (message: string, meta: LogMeta = {}) => {
    console.error(this.formatMessage('error', message, meta))
    
    // Always send errors to server
    this.sendToServer('error', message, meta)
  }
  
  // Wrapper for logging user actions
  userAction = (action: string, meta: LogMeta = {}) => {
    this.info(`User action: ${action}`, { action, ...meta })
  }
  
  // Wrapper for API call logging
  apiCall = (method: string, url: string, status: number, duration: number, meta: LogMeta = {}) => {
    const level = status >= 400 ? 'error' : 'info'
    const message = `API ${method} ${url} - ${status} (${duration}ms)`
    
    this[level](message, { 
      method, 
      url, 
      status, 
      duration, 
      type: 'api_call',
      ...meta 
    })
  }
  
  // Wrapper for performance logging
  performance = (name: string, duration: number, meta: LogMeta = {}) => {
    const level = duration > 1000 ? 'warn' : 'info'
    const message = `Performance: ${name} took ${duration}ms`
    
    this[level](message, { 
      name, 
      duration, 
      type: 'performance',
      ...meta 
    })
  }
}

const clientLogger = new ClientLogger()

// Global error handler for unhandled client errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    clientLogger.error('Unhandled JavaScript error', {
      message: event.error?.message || event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      type: 'unhandled_error'
    })
  })
  
  window.addEventListener('unhandledrejection', (event) => {
    clientLogger.error('Unhandled promise rejection', {
      reason: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      type: 'unhandled_rejection'
    })
  })
}

export default clientLogger 