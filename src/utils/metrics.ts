import { metrics, ValueType } from '@opentelemetry/api'

// Get the global meter instance
const meter = metrics.getMeter('callmiracle-business-metrics', '1.0.0')

// ================================
// Simplified Core Metrics
// ================================

export const createdMeetingsMetric = meter.createUpDownCounter('created_meetings', {
  description: 'Number of created meetings',
  valueType: ValueType.INT
})

export const matchedMeetingsMetric = meter.createUpDownCounter('matched_meetings', {
  description: 'Number of matched meetings',
  valueType: ValueType.INT
})

export const calledMeetingsMetric = meter.createUpDownCounter('called_meetings', {
  description: 'Number of called meetings',
  valueType: ValueType.INT
})



// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('📊 Flushing metrics before shutdown...')
})