import { Block, Meeting, MeetingStatus } from "@/generated/graphql"
import resolveConfig from "tailwindcss/resolveConfig"
import tailwindConfig from "../../tailwind.config"
import { ObjectId } from "mongodb"
import { format, addMinutes, isAfter, parseISO, setMinutes, setSeconds, setMilliseconds, differenceInMinutes, startOfHour, getMinutes, differenceInMilliseconds, isTomorrow, isToday } from 'date-fns'
import { enUS } from "date-fns/locale"
import { TimeSlot } from "@/components/TimeSlotsGrid"

export const SLOT_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
export const LATE_ALLOWANCE_FOR_HALF_HOUR_MEETING = 5 * 60 * 1000; // 5 minutes in milliseconds
export const LATE_ALLOWANCE_FOR_HOUR_MEETING = 10 * 60 * 1000; // 10 minutes in milliseconds

export function getLateAllowance(minDurationM: number) {
  if (minDurationM === 30) {
    return LATE_ALLOWANCE_FOR_HALF_HOUR_MEETING
  }
  return LATE_ALLOWANCE_FOR_HOUR_MEETING
}

export type TimeRange = {
  start: number;
  end: number;
}

// Helper function to combine adjacent time slots into time ranges
export const combineAdjacentSlots = (slots: number[]): TimeRange[] => {
  if (slots.length === 0) return [];
  
  // Sort slots chronologically
  const sortedSlots = [...slots].sort((a, b) => a - b);
  
  const now = new Date().getTime();
  const combinedSlots: TimeRange[] = [];
  let currentStart, currentEnd;
  
  for (let i = 0; i < sortedSlots.length; i++) {
    let slotStart = sortedSlots[i];
    const slotEnd = slotStart + SLOT_DURATION;
    if (now >= slotEnd) continue;
    if (now > slotStart) {
      slotStart = now;
    }
      
    // If this slot starts exactly when the previous ends, combine them
    if (slotStart === currentEnd) {
      // Extend the current slot
      currentEnd = slotEnd;
    } else {
      // This slot is not adjacent, so save the current combined slot and start a new one
      if (currentStart) {
        combinedSlots.push({ start: currentStart, end: currentEnd as number });
      }
      currentStart = slotStart;
      currentEnd = slotEnd;
    }
  }
  
  // Add the last range
  if (currentStart) {
    combinedSlots.push({ start: currentStart, end: currentEnd as number });
  }
  return combinedSlots;
}

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
  minDurationM: number
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
  
  const lastSlot = meeting.timeSlots[meeting.timeSlots.length - 1]

  const nowTime = now.getTime()
  if (nowTime > lastSlot + SLOT_DURATION) return true

  const combinedRanges = combineAdjacentSlots(meeting.timeSlots)
  const lateAllowance = getLateAllowance(meeting.minDurationM)
  const minDuration = meeting.minDurationM * 60 * 1000
  if ( combinedRanges.every(range => nowTime > range.end - minDuration + lateAllowance) ) return true

  return false
}

/**
 * Gets the shared interests between a meeting and its peer meeting
 * 
 * @param meeting The primary meeting
 * @param peerMeeting The peer meeting
 * @returns Array of shared interests
 */
export function getSharedInterests(
  meeting: { interests: string[], peerMeetingId?: string | null },
  peerMeeting?: { interests: string[] } | null
): string[] {
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
 * @param meeting The meeting object (must have .interests and .groupId)
 * @param meetingUser The user who owns the meeting (must have .blocks)
 * @param otherUser The user to check blocks against (must have ._id)
 * @returns Array of compatible interests
 */
export function getNonBlockedInterests(
  meeting: { interests: string[], groupId?: string },
  meetingUser: { blocks?: Block[] },
  otherUser: { _id: ObjectId }
): string[] {
  if (!meetingUser?.blocks) return meeting.interests

  const otherUserId = otherUser._id.toString()

  const block = meetingUser.blocks.find(b => b.userId === otherUserId)
  if (!block) return meeting.interests
  if (block.all) return []
  
  // Find the interests block for this meeting's group
  const groupInterestsBlock = block.interestsBlocks?.find(ib => ib.groupId === meeting.groupId)
  if (!groupInterestsBlock) return meeting.interests
  
  // If all interests in this group are blocked, return empty array
  if (groupInterestsBlock.all) return []
  
  // Filter out specific blocked interests for this group
  return meeting.interests.filter(interest => !groupInterestsBlock.interests.includes(interest))
}

function getOccupiedTimeSlots(meetings: Meeting[], currentMeetingId?: string) {
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

export function getTimeSlotsFromMeeting(meetings: Meeting[], meetingToConnectTimeSlots: number[]) {
  const occupiedTimeSlots = getOccupiedTimeSlots(meetings)
  const now = new Date().getTime()
  const slots: TimeSlot[] = []

  // Group meetingToConnectTimeSlots by dayKey
  const slotsByDay: { [dayKey: string]: number[] } = {}
  meetingToConnectTimeSlots.forEach(timestamp => {
    const date = new Date(timestamp)
    const dayKey = format(date, 'yyyy-MM-dd')
    if (!slotsByDay[dayKey]) slotsByDay[dayKey] = []
    slotsByDay[dayKey].push(timestamp)
  })

  Object.entries(slotsByDay).forEach(([dayKey, timestamps]) => {
    let prevTimestamp: number | null = null
    timestamps.forEach(timestamp => {
      const slotTime = new Date(timestamp)
      const endTime = addMinutes(slotTime, 30)
      // Only include if not completely in the past
      if (now > slotTime.getTime() + SLOT_DURATION) return

      // Insert dummy slot if there is a gap from the previous slot
      if (
        prevTimestamp !== null &&
        timestamp - prevTimestamp !== SLOT_DURATION
      ) {
        const prevEnd = new Date(prevTimestamp + SLOT_DURATION)
        slots.push({
          timestamp: prevEnd.getTime(),
          startTime: format(prevEnd, 'HH:mm'),
          endTime: format(slotTime, 'HH:mm'),
          day: format(slotTime, 'EEE'),
          dayKey,
          isDummy: true,
          isNow: false,
          isDisabled: true
        })
      }

      slots.push({
        timestamp,
        startTime: format(slotTime, 'HH:mm'),
        endTime: format(endTime, 'HH:mm'),
        day: format(slotTime, 'EEE'),
        dayKey,
        isNow: now > timestamp,
        isDisabled: occupiedTimeSlots.includes(slotTime.getTime())
      })
      prevTimestamp = timestamp
    })
  })

  return slots
}


export function getAvailableTimeSlots(meetings: Meeting[], currentMeetingId?: string) {
  const occupiedTimeSlots = getOccupiedTimeSlots(meetings, currentMeetingId)
  const now = new Date()
  const slots: TimeSlot[] = []

  // Find the most recent half-hour boundary (rounded down)
  const minutes = now.getMinutes()
  const roundedMinutes = minutes < 30 ? 0 : 30
  const firstSlotTime = setMilliseconds(setSeconds(setMinutes(new Date(now), roundedMinutes), 0), 0)

  // Today: only slots from firstSlotTime to end of today
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  let slotTime = new Date(firstSlotTime)
  while (slotTime <= endOfToday) {
    const endTime = addMinutes(slotTime, 30)
    slots.push({
      timestamp: slotTime.getTime(),
      startTime: format(slotTime, 'HH:mm'),
      endTime: format(endTime, 'HH:mm'),
      day: format(slotTime, 'EEE'),
      dayKey: format(slotTime, 'yyyy-MM-dd'),
      isNow: slotTime.getTime() === firstSlotTime.getTime(),
      isDisabled: occupiedTimeSlots.includes(slotTime.getTime())
    })
    slotTime = addMinutes(slotTime, 30)
  }

  // Next 6 days: full days (00:00 to 23:30)
  for (let dayOffset = 1; dayOffset <= 6; dayOffset++) {
    const day = addMinutes(startOfHour(now), (24 * 60) * dayOffset)
    const dayKey = format(day, 'yyyy-MM-dd')
    for (let halfHour = 0; halfHour < 48; halfHour++) {
      const slot = new Date(day)
      slot.setHours(0, 0, 0, 0)
      slot.setMinutes(halfHour * 30)
      const endTime = addMinutes(slot, 30)
      slots.push({
        timestamp: slot.getTime(),
        startTime: format(slot, 'HH:mm'),
        endTime: format(endTime, 'HH:mm'),
        day: format(slot, 'EEE'),
        dayKey,
        isNow: false,
        isDisabled: occupiedTimeSlots.includes(slot.getTime())
      })
    }
  }

  return slots
}

export function getSlotDuration(timestamp: number) {
  const now = new Date().getTime()
  if (now > timestamp + SLOT_DURATION) return 0; // slot is over
  const slotDuration = now > timestamp ? SLOT_DURATION - (now - timestamp) : SLOT_DURATION
  return slotDuration
}

export function getInterestsOverlap(interests1: string[], interests2: string[]) {
  return interests1.filter(interest => interests2.includes(interest)).length
}
