import { Block, Interest, Meeting, MeetingStatus } from "@/generated/graphql"
import resolveConfig from "tailwindcss/resolveConfig"
import tailwindConfig from "../../tailwind.config"
import { ObjectId } from "mongodb"
import { format, setMinutes, setSeconds, setMilliseconds, addMinutes, isToday, isTomorrow } from 'date-fns'
import { enUS } from "date-fns/locale"

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
  status?: MeetingStatus
}): boolean {
  const now = new Date()

  // If meeting status is FINISHED, it's passed
  if (meeting.status === MeetingStatus.Finished || meeting.status === MeetingStatus.Cancelled) {
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
 * Gets the shared interests between a meeting and its peer meeting
 * 
 * @param meeting The primary meeting
 * @param peerMeeting The peer meeting
 * @returns Array of shared interests
 */
export function getSharedInterests(
  meeting: { interests: Interest[], peerMeetingId?: string | null },
  peerMeeting?: { interests: Interest[] } | null
): Interest[] {
  if (!meeting.peerMeetingId || !peerMeeting) {
    return meeting.interests
  }
  
  return meeting.interests.filter(interest => 
    peerMeeting.interests.includes(interest)
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

export function class2Hex(tailwindColor: string) {
  // Convert Tailwind color classes like "text-gray-400" to hex color codes
  const colorMatch = tailwindColor.match(/([a-z]+)-(\d+)/)
  if (!colorMatch) return '#000000' // Default to black if no match
  
  const [_, colorName, shade] = colorMatch
  const fullConfig = resolveConfig(tailwindConfig)
  return (fullConfig.theme.colors as any)[colorName][shade]
}

/**
 * Returns interests from meeting that are not blocked by meetingUser for otherUser
 * @param meeting The meeting object (must have .interests)
 * @param meetingUser The user who owns the meeting (must have .blocks)
 * @param otherUser The user to check blocks against (must have ._id)
 * @returns Array of compatible interests
 */
export function getCompatibleInterests(
  meeting: { interests: Interest[] },
  meetingUser: { blocks?: Block[] },
  otherUser: { _id: ObjectId }
): Interest[] {
  if (!meetingUser?.blocks) return meeting.interests

  const otherUserId = otherUser._id.toString()

  const block = meetingUser.blocks.find(b => b.userId === otherUserId)
  if (!block) return meeting.interests
  if (block.all) return []
  return meeting.interests.filter(interest => !block.interests.includes(interest))
}

export function getOccupiedTimeSlots(meetings: Meeting[], currentMeetingId?: string) {
  return meetings
    .filter(m => !currentMeetingId || m._id !== currentMeetingId)
    .filter(m => !isMeetingPassed(m))
    .flatMap(m => {
      if (m.startTime) {
        // Only two slots: startTime and startTime + 30min
        return [m.startTime, m.startTime + 30 * 60 * 1000]
      }
      return m.timeSlots || []
    })
}

export const ACTIVE_MEETING_COLOR = 'text-green-400' // '#4ADE80'
export const PASSED_MEETING_COLOR = 'text-gray-400' // '#9CA3AF'
export const SCHEDULED_MEETING_COLOR = 'text-yellow-400' // '#FBBF24'
export const FINDING_MEETING_COLOR = 'text-blue-500' // '#3B82F6'


export function getMeetingColorClass(meeting: Meeting) {
  if (isMeetingPassed(meeting)) return PASSED_MEETING_COLOR; 

  if (meeting.startTime) {
    if ( meetingIsActiveNow(meeting) ) return ACTIVE_MEETING_COLOR
    return SCHEDULED_MEETING_COLOR
  }
  
  // Finding partner
  return FINDING_MEETING_COLOR; 
}

export function canEditMeeting(meeting: Meeting) {
  return (meeting.status === MeetingStatus.Cancelled || (meeting.status === MeetingStatus.Seeking && !isMeetingPassed(meeting)))
}

export function getDayLabel(date: Date, t: any) {
  // Get day of month with ordinal (e.g., 1st, 2nd, 3rd, 4th, ...)
  const day = date.getDate()
  const ordinal =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
      ? 'nd'
      : day % 10 === 3 && day !== 13
      ? 'rd'
      : 'th'
  const dayWithOrdinal = `${day}${ordinal}`

  const weekday = format(date, 'EEEE', { locale: enUS })
  const month = format(date, 'LLLL', { locale: enUS })

  if (isToday(date)) {
    return `${t('today')}, ${weekday}, ${dayWithOrdinal} of ${month}`
  }
  if (isTomorrow(date)) {
    return `${t('tomorrow')}, ${weekday}, ${dayWithOrdinal} of ${month}`
  }
  return `${weekday}, ${dayWithOrdinal} of ${month}`
}

export function meetingIsActiveNow(meeting: Meeting) {
  if (!meeting.startTime) return false
  const now = new Date()
  return now >= new Date(meeting.startTime) && !isMeetingPassed(meeting)
}
