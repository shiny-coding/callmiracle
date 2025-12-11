import { Block, Meeting, MeetingStatus } from "@/generated/graphql"
import resolveConfig from "tailwindcss/resolveConfig"
import tailwindConfig from "../../tailwind.config"
import { ObjectId } from "mongodb"
import { format, addMinutes, isAfter, parseISO, setMinutes, setSeconds, setMilliseconds, differenceInMinutes, startOfHour, getMinutes, differenceInMilliseconds, isTomorrow, isToday } from 'date-fns'
import { enUS, ru, type Locale } from "date-fns/locale"
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

/**
 * Get occupied time slots for a matched meeting based on its startTime and duration.
 * Returns 1-3 slots depending on how much time is left in the first slot.
 *
 * For 30-min meetings: 1 slot if ≥20 mins left, otherwise 2 slots
 * For 60-min meetings: 2 slots if they sum to ≥45 mins, otherwise 3 slots
 */
export function getOccupiedSlotsForMatchedMeeting(startTime: number, minDurationM: number): number[] {
  // Round startTime down to the previous 30-minute slot
  const startDate = new Date(startTime)
  const minutes = startDate.getMinutes()
  const roundedMinutes = minutes < 30 ? 0 : 30
  startDate.setMinutes(roundedMinutes, 0, 0)
  const slotStartTime = startDate.getTime()

  // Calculate time remaining in the first slot (from startTime to end of first slot)
  const firstSlotEnd = slotStartTime + SLOT_DURATION
  const timeInFirstSlotMs = firstSlotEnd - startTime

  const slots: number[] = [slotStartTime]

  if (minDurationM === 30) {
    // For 30-min meetings: add 2nd slot only if less than 20 mins left in first slot
    if (timeInFirstSlotMs < 20 * 60 * 1000) {
      slots.push(slotStartTime + SLOT_DURATION)
    }
  } else {
    // For 60-min meetings: always add 2nd slot, add 3rd if first two sum to less than 45 mins
    slots.push(slotStartTime + SLOT_DURATION)
    const timeInTwoSlotsMs = timeInFirstSlotMs + SLOT_DURATION
    if (timeInTwoSlotsMs < 45 * 60 * 1000) {
      slots.push(slotStartTime + 2 * SLOT_DURATION)
    }
  }

  return slots
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
  meeting: { language: string, peerMeetingId?: string | null },
  peerMeeting?: { language: string } | null
): string[] {
  if (!meeting.peerMeetingId || !peerMeeting) {
    return [meeting.language]
  }

  // Return array with the language if both meetings share it, otherwise empty array
  return meeting.language === peerMeeting.language ? [meeting.language] : []
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
        return getOccupiedSlotsForMatchedMeeting(m.startTime, m.minDurationM)
      }
      return m.timeSlots || []
    })
}

export const ACTIVE_MEETING_COLOR = 'text-green-600' // '#16A34A'
export const PASSED_MEETING_COLOR = 'text-gray-400' // '#9CA3AF'
export const SCHEDULED_MEETING_COLOR = 'text-yellow-400' // '#FBBF24'
export const FINDING_MEETING_COLOR = 'text-blue-500' // '#3B82F6'


export function getMeetingColorClass(meeting: Meeting) {
  if (isMeetingPassed(meeting)) return PASSED_MEETING_COLOR;

  if (meeting.startTime) {
    if ( meetingIsActiveNow(meeting) ) return ACTIVE_MEETING_COLOR
    return SCHEDULED_MEETING_COLOR
  }

  return FINDING_MEETING_COLOR;
}

/**
 * Gets the highest priority meeting color from a list of meetings
 * Priority: green (active) > yellow (scheduled) > blue (finding)
 * Ignores passed meetings
 *
 * @param meetings Array of meetings to evaluate
 * @returns The color class with highest priority, or null if no active meetings
 */
export function getHighestPriorityMeetingColor(meetings: Meeting[]): string | null {
  let hasGreen = false
  let hasYellow = false
  let hasBlue = false

  for (const meeting of meetings) {
    const colorClass = getMeetingColorClass(meeting)

    // Skip passed meetings
    if (colorClass === PASSED_MEETING_COLOR) continue

    if (colorClass === ACTIVE_MEETING_COLOR) {
      hasGreen = true
      break // Green is highest priority, no need to check further
    } else if (colorClass === SCHEDULED_MEETING_COLOR) {
      hasYellow = true
    } else if (colorClass === FINDING_MEETING_COLOR) {
      hasBlue = true
    }
  }

  if (hasGreen) return ACTIVE_MEETING_COLOR
  if (hasYellow) return SCHEDULED_MEETING_COLOR
  if (hasBlue) return FINDING_MEETING_COLOR
  return null
}

export function canEditMeeting(meeting: Meeting) {
  const now = new Date().getTime()

  // Find the last slot end time
  const lastSlotEnd = meeting.timeSlots && meeting.timeSlots.length > 0
    ? Math.max(...meeting.timeSlots) + SLOT_DURATION
    : null

  // Don't allow editing if last slot ended more than an hour ago
  if (lastSlotEnd && lastSlotEnd < now - 60 * 60 * 1000) {
    return false
  }

  // Don't allow editing cancelled meetings that were linked to a peer
  if (meeting.status === MeetingStatus.Cancelled && meeting.linkedToPeer) {
    return false
  }

  return (meeting.status === MeetingStatus.Cancelled || (meeting.status === MeetingStatus.Seeking && !isMeetingPassed(meeting)))
}

export function getDayLabel(date: Date, t: any, locale: string = 'en') {
  // Map locale codes to date-fns locales
  const dateFnsLocales: Record<string, Locale> = {
    'en': enUS,
    'ru': ru
  }

  const dateFnsLocale = dateFnsLocales[locale] || enUS

  // Get day of month with ordinal (only for English)
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

  const weekday = format(date, 'EEEE', { locale: dateFnsLocale })
  const month = format(date, 'LLLL', { locale: dateFnsLocale })

  if (isToday(date)) {
    // For Russian, use genitive case for month (handled by date-fns ru locale)
    return locale === 'ru'
      ? `${t('today')}, ${weekday}, ${day} ${format(date, 'LLLL', { locale: dateFnsLocale })}`
      : `${t('today')}, ${weekday}, ${dayWithOrdinal} of ${month}`
  }
  if (isTomorrow(date)) {
    return locale === 'ru'
      ? `${t('tomorrow')}, ${weekday}, ${day} ${format(date, 'LLLL', { locale: dateFnsLocale })}`
      : `${t('tomorrow')}, ${weekday}, ${dayWithOrdinal} of ${month}`
  }

  return locale === 'ru'
    ? `${weekday}, ${day} ${month}`
    : `${weekday}, ${dayWithOrdinal} of ${month}`
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
