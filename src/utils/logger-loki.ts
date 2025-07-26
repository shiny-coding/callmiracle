// This file is only imported when Loki is enabled
import LokiTransport from 'winston-loki'
import { format } from 'winston'
import { trace } from '@opentelemetry/api'

// Connection state tracking
const connectionState = {
  isConnected: true, // Start optimistic
  hasLoggedError: false,
  hasLoggedReconnect: false,
  lastErrorTime: 0,
  errorCount: 0
}

// Create Loki format for structured logs
const lokiFormat = format.combine(
  // format.timestamp(),
  // format.json(),
  // Add trace information as metadata but let format.json() handle serialization
  format((info) => {
    const span = trace.getActiveSpan()
    let traceId = undefined
    let spanId = undefined
    if (span) {
      traceId = span.spanContext().traceId
      spanId = span.spanContext().spanId
    }

    const { userId, userName, ip, path, requestId, userAgent, service, level, operationName, ...nonLabelInfo } = info as any

    const ordered = {
      message: info.message,
      path: info.path,
      requestId: info.requestId,
      userName: info.userName,
      userId: info.userId,
      // Add any other fields you want, in order
      ...nonLabelInfo, // This will add any remaining fields at the end
      userAgent: info.userAgent,
      service: info.service,
      level: info.level,
    }
    // Serialize to JSON string
    nonLabelInfo[Symbol.for('message')] = JSON.stringify(ordered)

    return {
      ...nonLabelInfo,
      labels: { userId, userName, ip, path, requestId, operationName, traceId, spanId }
    }
  })()
)

function handleConnectionError(err: any, context: string) {
  const now = Date.now()
  const timeSinceLastError = now - connectionState.lastErrorTime
  
  // Only log if we haven't logged an error recently (within 30 seconds) or this is the first error
  if (!connectionState.hasLoggedError || timeSinceLastError > 30000) {
    console.error(`❌ Loki ${context}:`, err.message || err)
    connectionState.hasLoggedError = true
    connectionState.hasLoggedReconnect = false // Reset reconnect flag
    connectionState.lastErrorTime = now
    connectionState.errorCount++
    
    if (connectionState.errorCount === 1) {
      console.warn('⚠️  Loki observability stack appears to be down. Logs will continue to be processed but not sent to Loki.')
    }
  }
  
  connectionState.isConnected = false
}

function handleConnectionSuccess(context: string) {
  const wasDisconnected = !connectionState.isConnected || connectionState.hasLoggedError
  
  connectionState.isConnected = true
  
  // Only log reconnection once
  if (wasDisconnected && !connectionState.hasLoggedReconnect) {
    console.log(`✅ Loki ${context}: Connection restored`)
    connectionState.hasLoggedError = false
    connectionState.hasLoggedReconnect = true
    connectionState.errorCount = 0
  }
}

export function createLokiTransport() {
  const lokiHost = process.env.LOKI_HOST || 'http://localhost:3100'
  const transport = new LokiTransport({
    host: lokiHost,
    labels: { 
      environment: process.env.NODE_ENV || 'development',
      service: 'callmiracle',
    },
    json: true,
    format: lokiFormat,
    batching: true,
    interval: 2, // 2 second
    onConnectionError: (err: any) => {
      handleConnectionError(err, 'connection error')
    },
    // Add more event handlers for debugging
    handleExceptions: false,
    handleRejections: false
  })
  
  // Add event listeners for debugging
  transport.on('error', (err: any) => {
    handleConnectionError(err, 'transport error')
  })
  
  // Listen for successful operations to detect reconnection
  transport.on('finish', () => {
    handleConnectionSuccess('batch sent')
  })
  
  // Also check on log attempts
  const originalLog = transport.log
  if (originalLog) {
    transport.log = function(info: any, callback: any) {
      // Call original log method with proper callback handling
      const result = originalLog.call(this, info, () => {
        handleConnectionSuccess('log operation')
        if (callback) callback()
      })
      return result
    }
  }
  
  console.log('✅ Loki transport created successfully')
  return transport
} 