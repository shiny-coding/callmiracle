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

export const callDurationHistogram = meter.createHistogram('call_duration_seconds', {
  description: 'Duration of completed calls in seconds',
  valueType: ValueType.DOUBLE,
  boundaries: [5, 10, 30, 60, 120, 300, 600, 1800, 3600] // 5s, 10s, 30s, 1m, 2m, 5m, 10m, 30m, 1h
})

export const totalCallDurationMetric = meter.createUpDownCounter('total_call_duration_seconds', {
  description: 'Total cumulative call duration in seconds',
  valueType: ValueType.DOUBLE
})

export const cancelledMeetingsMetric = meter.createUpDownCounter('cancelled_meetings', {
  description: 'Number of meetings cancelled after matching',
  valueType: ValueType.INT
})

export const deletedMeetingsMetric = meter.createUpDownCounter('deleted_meetings', {
  description: 'Number of meetings deleted (with peer disconnection)',
  valueType: ValueType.INT
})

export const sessionDurationHistogram = meter.createHistogram('session_duration_seconds', {
  description: 'User session duration in seconds',
  valueType: ValueType.DOUBLE
})

export const dailyActiveUsersMetric = meter.createUpDownCounter('daily_active_users', {
  description: 'Number of unique users active today',
  valueType: ValueType.INT
})

export const weeklyActiveUsersMetric = meter.createUpDownCounter('weekly_active_users', {
  description: 'Number of unique users active this week',
  valueType: ValueType.INT
})

export const totalSessionsMetric = meter.createUpDownCounter('total_sessions', {
  description: 'Total number of user sessions',
  valueType: ValueType.INT
})

// Push Notification Metrics
export const pushNotificationsSentMetric = meter.createUpDownCounter('push_notifications_sent', {
  description: 'Total push notifications sent',
  valueType: ValueType.INT
})

export const pushNotificationsDeliveredMetric = meter.createUpDownCounter('push_notifications_delivered', {
  description: 'Push notifications successfully delivered',
  valueType: ValueType.INT
})

export const pushNotificationsFailedMetric = meter.createUpDownCounter('push_notifications_failed', {
  description: 'Push notifications failed to deliver',
  valueType: ValueType.INT
})

export const pushNotificationsClickedMetric = meter.createUpDownCounter('push_notifications_clicked', {
  description: 'Push notifications clicked/opened by users',
  valueType: ValueType.INT
})

export const fcmTokenRegistrationsMetric = meter.createUpDownCounter('fcm_token_registrations', {
  description: 'FCM token registration attempts',
  valueType: ValueType.INT
})

export const fcmTokenRegistrationFailuresMetric = meter.createUpDownCounter('fcm_token_registration_failures', {
  description: 'Failed FCM token registrations',
  valueType: ValueType.INT
})



// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('📊 Flushing metrics before shutdown...')
})