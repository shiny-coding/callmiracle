import { Block, Interest, Meeting, MeetingStatus } from "@/generated/graphql"
import resolveConfig from "tailwindcss/resolveConfig"
import tailwindConfig from "../../tailwind.config"
import { ObjectId } from "mongodb"

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
    .flatMap(m => m.timeSlots || [])
}