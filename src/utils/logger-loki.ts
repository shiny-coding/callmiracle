// This file is only imported when Loki is enabled
import LokiTransport from 'winston-loki'
import { format } from 'winston'
import { trace } from '@opentelemetry/api'

// Create Loki format for structured logs
const lokiFormat = format.combine(
  // format.timestamp(),
  // format.json(),
  // Add trace information as metadata but let format.json() handle serialization
  format((info) => {
    const span = trace.getActiveSpan()
    if (span) {
      info.traceId = span.spanContext().traceId
      info.spanId = span.spanContext().spanId
    }

    const { userId, userName, ip, path, requestId, userAgent, service, level, ...nonLabelInfo } = info as any

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
      labels: { userId, userName, ip, path, requestId }
    }
  })()
)

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
      console.error('❌ Loki connection error:', err.message || err)
    },
    // Add more event handlers for debugging
    handleExceptions: false,
    handleRejections: false
  })
  
  // Add event listeners for debugging
  transport.on('error', (err: any) => {
    console.error('❌ Loki transport error:', err.message || err)
  })
  
  console.log('✅ Loki transport created successfully')
  return transport
} 