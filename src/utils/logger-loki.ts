// This file is only imported when Loki is enabled
import LokiTransport from 'winston-loki'
import { format } from 'winston'
import { trace } from '@opentelemetry/api'

// Create Loki format for structured logs
const lokiFormat = format.combine(
  format.timestamp(),
  format.json(),
  format.printf(({ timestamp, level, message, service, userId, userName, requestId, path: reqPath, ...metadata }) => {
    const span = trace.getActiveSpan()
    const traceId = span?.spanContext().traceId || undefined
    
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: service || 'callmiracle',
      userId,
      userName,
      requestId,
      path: reqPath,
      traceId,
      ...metadata
    })
  })
)

export function createLokiTransport() {
  return new LokiTransport({
    host: process.env.LOKI_HOST || 'http://localhost:3100',
    labels: { 
      app: 'callmiracle',
      environment: process.env.NODE_ENV || 'development',
      service: 'main'
    },
    json: true,
    format: lokiFormat,
    replaceTimestamp: true,
    onConnectionError: (err: any) => {
      console.error('Loki connection error:', err)
    }
  })
} 