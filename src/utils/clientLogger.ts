'use client'

import { mapStackTrace } from 'sourcemapped-stacktrace'

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
    this.clientLogLevel = level
  }

  private shouldLog(messageLevel: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    const currentIndex = levels.indexOf(this.clientLogLevel)
    const messageIndex = levels.indexOf(messageLevel)
    return messageIndex >= currentIndex
  }

  // Helper to map stack trace using source maps
  private mapStackTraceIfPresent = async (meta: LogMeta): Promise<LogMeta> => {
    if (!meta.stack || typeof meta.stack !== 'string') {
      return meta
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // If mapping takes too long, keep stack as-is and add originalStack
        resolve({
          ...meta,
          originalStack: meta.stack
        })
      }, 2000) // 2 second timeout

      try {
        const originalStack = meta.stack
        const originalLines = originalStack.split('\n')

        mapStackTrace(originalStack, (mappedStack) => {
          clearTimeout(timeout)

          const mappedString = mappedStack.join('\n')

          // Always include both stacks
          // stack = mapped version (may contain some unmapped lines)
          // originalStack = original webpack chunks
          resolve({
            ...meta,
            stack: mappedString,
            originalStack: meta.stack
          })
        })
      } catch (error) {
        clearTimeout(timeout)
        // If mapping fails, keep stack as-is and add originalStack
        resolve({
          ...meta,
          originalStack: meta.stack
        })
      }
    })
  }

  private sendToServer = async (level: string, message: string, meta: LogMeta = {}) => {
    if (!this.isEnabled) return

    try {
      // Use user's clientLogLevel to determine what to send to server
      const shouldSend = this.shouldLog(level)

      if (shouldSend) {
        // Map stack trace if present
        const mappedMeta = await this.mapStackTraceIfPresent(meta)

        fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level,
            message,
            meta: {
              ...mappedMeta,
              url: window.location.href,
              userAgent: navigator.userAgent
              // No timestamp - Loki will timestamp when log is received
              // This avoids issues with client clock skew
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
    this.addToBuffer('debug', message, meta)

    if (!this.shouldLog('debug')) return

    console.debug(this.formatMessage('debug', message, meta))

    // Send to server based on user's clientLogLevel
    this.sendToServer('debug', message, meta)
  }

  info = (message: string, meta: LogMeta = {}) => {
    this.addToBuffer('info', message, meta)

    if (!this.shouldLog('info')) return

    console.info(this.formatMessage('info', message, meta))

    // Send to server based on user's clientLogLevel
    this.sendToServer('info', message, meta)
  }

  warn = (message: string, meta: LogMeta = {}) => {
    this.addToBuffer('warn', message, meta)

    if (!this.shouldLog('warn')) return

    // Set flag to prevent console.warn interception for our own logs
    if (typeof window !== 'undefined') {
      (window as any).__clientLoggerLogging = true
    }

    console.warn(this.formatMessage('warn', message, meta))

    if (typeof window !== 'undefined') {
      (window as any).__clientLoggerLogging = false
    }

    // Send to server based on user's clientLogLevel
    this.sendToServer('warn', message, meta)
  }

  error = (message: string, meta: LogMeta = {}) => {
    this.addToBuffer('error', message, meta)

    if (!this.shouldLog('error')) return

    // Set flag to prevent console.error interception for our own logs
    if (typeof window !== 'undefined') {
      (window as any).__clientLoggerLogging = true
    }

    console.error(this.formatMessage('error', message, meta))

    if (typeof window !== 'undefined') {
      (window as any).__clientLoggerLogging = false
    }

    // Send to server based on user's clientLogLevel
    this.sendToServer('error', message, meta)
  }

  // Silent error - sends to server only, doesn't show in console
  // Use for errors that browser will display natively (like unhandled errors)
  errorSilent = (message: string, meta: LogMeta = {}) => {
    this.addToBuffer('error', message, meta)

    if (!this.shouldLog('error')) return

    // Only send to server, don't show in console (browser will show it natively)
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
    // Use errorSilent because browser will show the error natively
    // We only want to send to Grafana, not duplicate in console
    const hasStack = !!event.error?.stack
    clientLogger.errorSilent('Unhandled JavaScript error', {
      message: event.error?.message || event.message,
      // Only include filename/lineno/colno if no stack trace (fallback info)
      ...(hasStack ? {} : {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }),
      stack: event.error?.stack,
      type: 'unhandled_error'
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    // Use errorSilent because browser will show the rejection natively
    clientLogger.errorSilent('Unhandled promise rejection', {
      reason: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      type: 'unhandled_rejection'
    })
  })

  // Intercept console.error and console.warn to capture them in our logger
  const originalConsoleError = console.error
  const originalConsoleWarn = console.warn

  // Flag to prevent infinite loops when our logger calls console methods
  let isLoggingToConsole = false

  // Helper to create console interceptors with DRY principle
  const createConsoleInterceptor = (
    originalMethod: typeof console.error | typeof console.warn,
    level: 'error' | 'warn',
    defaultMessage: string
  ) => {
    return (...args: any[]) => {
      // Skip interception for clientLogger's own logs (CHECK FIRST!)
      if ((window as any).__clientLoggerLogging) {
        originalMethod.apply(console, args)
        return
      }

      // Prevent infinite loop
      if (isLoggingToConsole) {
        originalMethod.apply(console, args)
        return
      }

      // Call original console method so it still shows in browser console
      originalMethod.apply(console, args)

      try {
        isLoggingToConsole = true

        // Extract message and metadata
        const firstArg = args[0]
        let message = defaultMessage
        const meta: LogMeta = {}

        if (firstArg instanceof Error) {
          message = firstArg.message
          meta.stack = firstArg.stack
          meta.name = firstArg.name
        } else if (typeof firstArg === 'string') {
          // Handle printf-style format strings (e.g., "Error in %s: %s", "Object: %o")
          // Supports %s (string), %o/%O (object), %d/%i (integer), %f (float)
          const formatRegex = /%[sOodif]/g
          if (args.length > 1 && formatRegex.test(firstArg)) {
            let formattedMessage = firstArg
            const formatArgs = args.slice(1)
            let argIndex = 0
            formattedMessage = formattedMessage.replace(/%[sOodif]/g, (match) => {
              if (argIndex < formatArgs.length) {
                const arg = formatArgs[argIndex++]
                // Convert arg based on format specifier
                if (typeof arg === 'object' && arg !== null) {
                  try {
                    return JSON.stringify(arg, null, 2)
                  } catch {
                    return String(arg)
                  }
                }
                return String(arg)
              }
              return match
            })
            message = formattedMessage
            // Store any remaining args that weren't used in formatting
            if (argIndex < formatArgs.length) {
              meta.additionalArgs = formatArgs.slice(argIndex)
            }
          } else {
            message = firstArg
            // Include additional arguments if present
            if (args.length > 1) {
              meta.additionalArgs = args.slice(1).map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                  try {
                    return JSON.stringify(arg, null, 2)
                  } catch {
                    return String(arg)
                  }
                }
                return String(arg)
              })
            }
          }
        } else {
          message = String(firstArg)
          // Include additional arguments if present
          if (args.length > 1) {
            meta.additionalArgs = args.slice(1).map(arg => {
              if (typeof arg === 'object' && arg !== null) {
                try {
                  return JSON.stringify(arg, null, 2)
                } catch {
                  return String(arg)
                }
              }
              return String(arg)
            })
          }
        }

        // Add to our logger with appropriate level
        clientLogger[level](`[Console] ${message}`, { ...meta, type: `console_${level}` })
      } finally {
        isLoggingToConsole = false
      }
    }
  }

  // Install interceptors
  console.error = createConsoleInterceptor(originalConsoleError, 'error', 'Console error')
  console.warn = createConsoleInterceptor(originalConsoleWarn, 'warn', 'Console warning')
}

export default clientLogger 