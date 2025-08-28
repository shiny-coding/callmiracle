import { sessionDurationHistogram, dailyActiveUsersMetric, weeklyActiveUsersMetric, totalSessionsMetric } from './metrics'

// In-memory session tracking (for simple implementation)
const userSessions = new Map<string, { startTime: number, lastActivity: number }>()
const dailyActiveUsers = new Set<string>()
const weeklyActiveUsers = new Set<string>()

// Reset daily users at midnight
let lastDayReset = new Date().toDateString()
// Reset weekly users on Monday
let lastWeekReset = getWeekKey(new Date())

function getWeekKey(date: Date): string {
  const monday = new Date(date)
  const dayOfWeek = monday.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Handle Sunday (0) as well
  monday.setDate(monday.getDate() + diff)
  return monday.toDateString()
}

function checkAndResetPeriods() {
  const now = new Date()
  const currentDay = now.toDateString()
  const currentWeek = getWeekKey(now)

  // Reset daily users
  if (currentDay !== lastDayReset) {
    dailyActiveUsers.clear()
    lastDayReset = currentDay
  }

  // Reset weekly users  
  if (currentWeek !== lastWeekReset) {
    weeklyActiveUsers.clear()
    lastWeekReset = currentWeek
  }
}

export function trackUserActivity(userId: string) {
  checkAndResetPeriods()

  const now = Date.now()
  const existingSession = userSessions.get(userId)

  if (!existingSession) {
    // New session
    userSessions.set(userId, { startTime: now, lastActivity: now })
    totalSessionsMetric.add(1)
    console.log(`📊 New session started for user: ${userId}`)
  } else {
    // Update existing session
    existingSession.lastActivity = now
  }

  // Track daily/weekly active users
  if (!dailyActiveUsers.has(userId)) {
    dailyActiveUsers.add(userId)
    dailyActiveUsersMetric.add(1)
  }

  if (!weeklyActiveUsers.has(userId)) {
    weeklyActiveUsers.add(userId)
    weeklyActiveUsersMetric.add(1)
  }
}

export function endUserSession(userId: string) {
  const session = userSessions.get(userId)
  if (session) {
    const sessionDuration = (Date.now() - session.startTime) / 1000 // Convert to seconds
    sessionDurationHistogram.record(sessionDuration)
    userSessions.delete(userId)
    console.log(`📊 Session ended for user: ${userId}, duration: ${sessionDuration}s`)
  }
}

// Clean up stale sessions (older than 1 hour)
export function cleanupStaleSessions() {
  const now = Date.now()
  const oneHour = 60 * 60 * 1000

  for (const [userId, session] of userSessions.entries()) {
    if (now - session.lastActivity > oneHour) {
      endUserSession(userId)
    }
  }
}

// Run cleanup every 10 minutes
if (typeof window === 'undefined') { // Server-side only
  setInterval(cleanupStaleSessions, 10 * 60 * 1000)
}