// Edge Runtime safe metrics wrapper
// This module provides a safe interface for metrics that works in both Node.js and Edge Runtime

interface SafeMetric {
  add: (value: number, attributes?: Record<string, any>) => void
  record: (value: number, attributes?: Record<string, any>) => void
}

// Create safe metric objects that do nothing in Edge Runtime
const createSafeMetric = (): SafeMetric => ({
  add: () => {},
  record: () => {}
})

// Export safe metric objects - these will be no-ops in Edge Runtime
export const sessionDurationHistogram = createSafeMetric()
export const dailyActiveUsersMetric = createSafeMetric()
export const weeklyActiveUsersMetric = createSafeMetric()
export const totalSessionsMetric = createSafeMetric()
export const hourlyActiveUsersMetric = createSafeMetric()
export const timezoneUsageMetric = createSafeMetric()
export const peakUsageWindowMetric = createSafeMetric()

// In Node.js runtime, replace the no-op metrics with real ones
// This will be executed during module loading in Node.js (not Edge Runtime)
try {
  // Check if we're in a Node.js environment (this will be undefined in Edge Runtime)
  // @ts-ignore - We're intentionally checking for Node.js globals
  if (typeof global !== 'undefined' && typeof require !== 'undefined') {
    // Dynamic import of metrics - this will only work in Node.js
    const metrics = require('./metrics')
    
    // Replace the no-op metrics with real ones
    Object.assign(sessionDurationHistogram, metrics.sessionDurationHistogram)
    Object.assign(dailyActiveUsersMetric, metrics.dailyActiveUsersMetric)
    Object.assign(weeklyActiveUsersMetric, metrics.weeklyActiveUsersMetric)
    Object.assign(totalSessionsMetric, metrics.totalSessionsMetric)
    Object.assign(hourlyActiveUsersMetric, metrics.hourlyActiveUsersMetric)
    Object.assign(timezoneUsageMetric, metrics.timezoneUsageMetric)
    Object.assign(peakUsageWindowMetric, metrics.peakUsageWindowMetric)
  }
} catch (error) {
  // Silent failure in Edge Runtime - metrics will remain no-ops
}