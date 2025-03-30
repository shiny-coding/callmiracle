/**
 * Determines if a meeting has passed based on various conditions
 * 
 * @param meeting The meeting object to check
 * @param now Current date/time (defaults to now)
 * @returns boolean indicating if the meeting has passed
 */
export function isMeetingPassed(meeting: {
  startTime?: number | null
  lastCallTime?: number | null
  timeSlots: number[]
  minDuration: number
  status?: string
}): boolean {
  const now = new Date()

  // If meeting status is FINISHED, it's passed
  if (meeting.status === 'FINISHED') {
    return true
  }
  
  // If meeting has a startTime
  if (meeting.startTime) {
    
    // If lastCallTime is null, it's passed if now > startTime + 30 mins
    if (!meeting.lastCallTime) {
      const thirtyMinsAfterStart = new Date(meeting.startTime + 30 * 60 * 1000)
      return now > thirtyMinsAfterStart
    }
    
    // If lastCallTime is not null, it's passed if lastCallTime was more than 30 mins ago
    const thirtyMinsAfterLastCall = new Date(meeting.lastCallTime + 30 * 60 * 1000)
    return now > thirtyMinsAfterLastCall
  }
  
  // If meeting doesn't have startTime, check if all time slots are in the past
  
  const lastSlot = Math.max(...meeting.timeSlots)

  const bufferMinutes = meeting.minDuration === 30 ? 10 : 20
  const cutoffTime = new Date(lastSlot + bufferMinutes * 60 * 1000)

  return now > cutoffTime
}

/**
 * Gets the shared statuses between a meeting and its peer meeting
 * 
 * @param meeting The primary meeting
 * @param peerMeeting The peer meeting
 * @returns Array of shared statuses
 */
export function getSharedStatuses(
  meeting: { statuses: string[], peerMeetingId?: string | null },
  peerMeeting?: { statuses: string[] } | null
): string[] {
  if (!meeting.peerMeetingId || !peerMeeting) {
    return meeting.statuses
  }
  
  return meeting.statuses.filter(status => 
    peerMeeting.statuses.includes(status)
  )
}

/**
 * Gets the shared languages between a meeting and its peer meeting
 * 
 * @param meeting The primary meeting
 * @param peerMeeting The peer meeting
 * @returns Array of shared languages
 */
export function getSharedLanguages(
  meeting: { languages: string[], peerMeetingId?: string | null },
  peerMeeting?: { languages: string[] } | null
): string[] {
  if (!meeting.peerMeetingId || !peerMeeting) {
    return meeting.languages
  }
  
  return meeting.languages.filter(language => 
    peerMeeting.languages.includes(language)
  )
} 