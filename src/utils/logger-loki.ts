// This file is only imported when Loki is enabled
import LokiTransport from 'winston-loki'
import { format } from 'winston'
import { trace } from '@opentelemetry/api'

// Global connection state tracking - shared across all transport instances
// Use global object to persist across module reloads in development
declare global {
  var __lokiConnectionState: {
    isConnected: boolean
    hasLoggedError: boolean
    hasLoggedReconnect: boolean
    lastErrorTime: number
    errorCount: number
    transportCount: number
  } | undefined
}

if (!global.__lokiConnectionState) {
  global.__lokiConnectionState = {
    isConnected: true, // Start optimistic
    hasLoggedError: false,
    hasLoggedReconnect: false,
    lastErrorTime: 0,
    errorCount: 0,
    transportCount: 0 // Track how many transports exist
  }
}

const globalConnectionState = global.__lokiConnectionState

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

    const { userId, userName, ip, path, requestId, userAgent, service, level, operationName, source, ...nonLabelInfo } = info as any

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
      labels: { userId, userName, ip, path, requestId, operationName, traceId, spanId, level, source }
    }
  })()
)

function handleConnectionError(err: any, context: string) {
  const now = Date.now()
  
  // Only log the very first error, then stay silent until connection is restored
  if (!globalConnectionState.hasLoggedError) {
    console.error(`❌ Loki ${context}:`, err.message || err)
    console.warn('❌  Loki observability stack appears to be down. Logs will continue to be processed but not sent to Loki.')
    
    globalConnectionState.hasLoggedError = true
    globalConnectionState.hasLoggedReconnect = false // Reset reconnect flag
    globalConnectionState.lastErrorTime = now
    globalConnectionState.errorCount++
  }
  
  globalConnectionState.isConnected = false
}

function handleConnectionSuccess(context: string) {
  const wasDisconnected = !globalConnectionState.isConnected || globalConnectionState.hasLoggedError
  
  globalConnectionState.isConnected = true
  
  // Only log reconnection once
  if (wasDisconnected && !globalConnectionState.hasLoggedReconnect) {
    console.log(`✅ Loki ${context}: Connection restored`)
    globalConnectionState.hasLoggedError = false
    globalConnectionState.hasLoggedReconnect = true
    globalConnectionState.errorCount = 0
  }
}

export function createLokiTransport() {
  globalConnectionState.transportCount++
  const transportId = globalConnectionState.transportCount
  
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
  
  transport.on('finish', () => {
    handleConnectionSuccess('batch sent')
  })
  
  // Check on log attempts
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
  
  // Only log transport creation for the first one, or if this is unexpected
  if (transportId === 1) {
    console.log('✅ Loki transport created successfully')
  } else {
    console.warn(`⚠️  Multiple Loki transports detected (${transportId}). This may cause duplicate logging.`)
  }
  
  return transport
}

 