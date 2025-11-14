'use client'

// Client-side logger that can optionally send logs to server
interface LogMeta {
  [key: string]: any
}

interface LogEntry {
  timestamp: string
  level: string
  message: string
  meta: LogMeta
}

class ClientLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isEnabled = typeof window !== 'undefined'
  private clientLogLevel = 'info' // Temporarily set to 'info' for debugging DeviceSettings
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 300

  private formatMessage(level: string, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`
  }

  private addToBuffer(level: string, message: string, meta: LogMeta = {}) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    }

    this.logBuffer.push(entry)

    // Keep only last maxBufferSize entries
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift()
    }
  }

  // Get all logs from buffer
  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer]
  }

  // Clear log buffer
  clearLogBuffer() {
    this.logBuffer = []
  }

  // Set the client log level (called when session is available)
  setLogLevel(level: string) {
    console.log('[ClientLogger] Setting log level to:', level)
    this.clientLogLevel = level
  }

  private shouldLog(messageLevel: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    const currentIndex = levels.indexOf(this.clientLogLevel)
    const messageIndex = levels.indexOf(messageLevel)
    return messageIndex >= currentIndex
  }
  
  private sendToServer = async (level: string, message: string, meta: LogMeta = {}) => {
    if (!this.isEnabled) {
      console.log('[ClientLogger] sendToServer skipped - not enabled')
      return
    }

    try {
      // Use user's clientLogLevel to determine what to send to server
      const shouldSend = this.shouldLog(level)

      console.log('[ClientLogger] sendToServer:', { level, message: message.slice(0, 50), shouldSend, currentLogLevel: this.clientLogLevel })

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
        }).then(() => {
          console.log('[ClientLogger] Successfully sent to server:', level, message.slice(0, 30))
        }).catch((err) => {
          console.error('[ClientLogger] Failed to send to server:', err)
        })
      }
    } catch (error) {
      console.error('[ClientLogger] sendToServer error:', error)
    }
  }
  
  debug = (message: string, meta: LogMeta = {}) => {
    this.addToBuffer('debug', message, meta)

    if (!this.shouldLog('debug')) return

    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, meta))
    }

    // Send to server based on user's clientLogLevel
    this.sendToServer('debug', message, meta)
  }

  info = (message: string, meta: LogMeta = {}) => {
    this.addToBuffer('info', message, meta)

    if (!this.shouldLog('info')) return

    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message, meta))
    }

    // Send to server based on user's clientLogLevel
    this.sendToServer('info', message, meta)
  }

  warn = (message: string, meta: LogMeta = {}) => {
    this.addToBuffer('warn', message, meta)

    if (!this.shouldLog('warn')) return

    if (this.isDevelopment) {
      console.warn(this.formatMessage('warn', message, meta))
    }

    // Send to server based on user's clientLogLevel
    this.sendToServer('warn', message, meta)
  }

  error = (message: string, meta: LogMeta = {}) => {
    this.addToBuffer('error', message, meta)

    if (!this.shouldLog('error')) return

    console.error(this.formatMessage('error', message, meta))

    // Send to server based on user's clientLogLevel
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

// Export LogEntry type for use in components
export type { LogEntry }

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