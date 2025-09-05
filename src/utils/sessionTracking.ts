import { 
  sessionDurationHistogram, 
  dailyActiveUsersMetric, 
  weeklyActiveUsersMetric, 
  totalSessionsMetric, 
  hourlyActiveUsersMetric, 
  timezoneUsageMetric, 
  peakUsageWindowMetric 
} from './metrics-edge-safe'

// In-memory session tracking (for simple implementation)
const userSessions = new Map<string, { startTime: number, lastActivity: number }>()
const dailyActiveUsers = new Set<string>()
const weeklyActiveUsers = new Set<string>()
const hourlyActiveUsers = new Map<number, Set<string>>() // hour -> Set of userIds

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
  const currentHour = now.getHours()

  // Reset daily users
  if (currentDay !== lastDayReset) {
    dailyActiveUsers.clear()
    hourlyActiveUsers.clear() // Reset hourly tracking daily
    lastDayReset = currentDay
  }

  // Reset weekly users  
  if (currentWeek !== lastWeekReset) {
    weeklyActiveUsers.clear()
    lastWeekReset = currentWeek
  }

  // Initialize current hour if not exists
  if (!hourlyActiveUsers.has(currentHour)) {
    hourlyActiveUsers.set(currentHour, new Set<string>())
  }
}

export function trackUserActivity(userId: string) {
  checkAndResetPeriods()

  const now = Date.now()
  const currentHour = new Date().getHours()
  const existingSession = userSessions.get(userId)

  if (!existingSession) {
    // New session
    userSessions.set(userId, { startTime: now, lastActivity: now })
    totalSessionsMetric.add(1)
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

  // Track hourly active users
  const currentHourUsers = hourlyActiveUsers.get(currentHour)!
  if (!currentHourUsers.has(userId)) {
    currentHourUsers.add(userId)
    hourlyActiveUsersMetric.add(1, { hour: currentHour.toString() })
  }

  // Track timezone usage - get timezone from user's local time
  try {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    timezoneUsageMetric.add(1, { timezone: userTimezone })
  } catch (error) {
    // Intl may not be available in all runtime environments
  }
}

export function endUserSession(userId: string) {
  const session = userSessions.get(userId)
  if (session) {
    const sessionDuration = (Date.now() - session.startTime) / 1000 // Convert to seconds
    sessionDurationHistogram.record(sessionDuration)
    userSessions.delete(userId)
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

// Calculate optimal matching window scores
export function updatePeakUsageScores() {
  const now = new Date()
  const currentHour = now.getHours()
  
  // Calculate peak usage score based on hourly active users
  for (let hour = 0; hour < 24; hour++) {
    const hourUsers = hourlyActiveUsers.get(hour)?.size || 0
    
    // Calculate optimization score: more users = better matching potential
    // Normalize to 0-1 scale where 1 represents optimal matching conditions
    const totalDailyUsers = dailyActiveUsers.size
    const hourlyScore = totalDailyUsers > 0 ? hourUsers / totalDailyUsers : 0
    
    peakUsageWindowMetric.record(hourlyScore, { hour: hour.toString() })
  }
}

// Run cleanup every 10 minutes and update peak usage scores
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    cleanupStaleSessions()
    updatePeakUsageScores()
  }, 10 * 60 * 1000)
}