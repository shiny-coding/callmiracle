import { Meeting, MeetingWithPeer, User } from '@/generated/graphql'
import { format, setMinutes, setSeconds, setMilliseconds, isToday } from 'date-fns'
import { TimeSlot } from './TimeSlotsGrid'
import { SLOT_DURATION, getLateAllowance, getSlotDuration, isMeetingPassed, getOccupiedSlotsForMatchedMeeting } from '@/utils/meetingUtils'

export type MeetingWithInfo = {
  meeting: Meeting,
  joinable: boolean,
}

export function getCalendarTimeSlots(now: number, hoursAhead: number): TimeSlot[] {
  const slots = []
  const nowDate = new Date(now)
  const minutes = nowDate.getMinutes()
  let firstSlotStart: Date

  // Find the previous half-hour boundary
  if (minutes < 30) {
    firstSlotStart = setMilliseconds(setSeconds(setMinutes(new Date(now), 0), 0), 0)
  } else {
    firstSlotStart = setMilliseconds(setSeconds(setMinutes(new Date(now), 30), 0), 0)
  }

  const end = now + hoursAhead * 60 * 60 * 1000
  for (let t = firstSlotStart.getTime(); t < end; t += SLOT_DURATION) {
    const slotStart = new Date(t)
    const slotEnd = new Date(t + SLOT_DURATION)
    const isNow = t <= now && now < t + SLOT_DURATION
    slots.push({
      timestamp: t,
      startTime: format(slotStart, 'HH:mm'),
      endTime: format(slotEnd, 'HH:mm'),
      dayKey: format(slotStart, 'yyyy-MM-dd'),
      isNow,
      day: isToday(slotStart)
        ? `Today (${format(slotStart, 'EEE, yyyy-MM-dd')})`
        : format(slotStart, 'EEE, yyyy-MM-dd')
    })
  }
  return slots
}

export type SlotMeetingData = {
  displayMeetings: MeetingWithInfo[]
  totalCount: number
}

export function prepareTimeSlotsInfos(futureMeetingsWithPeers: MeetingWithPeer[], slots: TimeSlot[], myMeetingsWithPeers: MeetingWithPeer[], currentUser: User) {
  const slot2meetingData: Record<number, SlotMeetingData> = {}
  for (let i = 0; i < slots.length; i++) {
    slot2meetingData[slots[i].timestamp] = { displayMeetings: [], totalCount: 0 }
  }

  // Create a set of all time slots occupied by user's own meetings
  const myOccupiedSlots = new Set<number>()
  myMeetingsWithPeers.forEach(meetingWithPeer => {
    const meeting = meetingWithPeer.meeting
    if (isMeetingPassed(meeting)) return

    if (meeting.startTime) {
      // For matched meetings, use utility function to get occupied slots
      getOccupiedSlotsForMatchedMeeting(meeting.startTime, meeting.minDurationM).forEach(slot => {
        myOccupiedSlots.add(slot)
      })
    } else {
      // If meeting is not scheduled yet, add all its time slots
      meeting.timeSlots.forEach(slot => {
        myOccupiedSlots.add(slot)
      })
    }
  })

  const now = Date.now()
  for (const meetingWithPeer of futureMeetingsWithPeers) {
    const futureMeeting = meetingWithPeer.meeting
    const isFilteredOut = meetingWithPeer.filteredOut

    if (isMeetingPassed(futureMeeting)) continue

    const isMine = currentUser._id === futureMeeting.userId

    // For my matched meetings, only show occupied slots
    if (isMine && futureMeeting.startTime) {
      const occupiedSlots = getOccupiedSlotsForMatchedMeeting(futureMeeting.startTime, futureMeeting.minDurationM)
      for (const slot of occupiedSlots) {
        if (slot < slots[0].timestamp) continue
        if (slot2meetingData[slot]) {
          slot2meetingData[slot].displayMeetings.push({ meeting: futureMeeting, joinable: false })
          slot2meetingData[slot].totalCount++
        }
      }
      continue
    }

    // For seeking meetings or other users' meetings, use original timeSlots logic
    let foundFirstJoinable = false
    for (let i = 0; i < futureMeeting.timeSlots.length; i++) {
      const slot = futureMeeting.timeSlots[i]
      if ( slot < slots[0].timestamp ) {
        continue
      }

      const nextSlot = futureMeeting.timeSlots[i + 1]
      const nextSlotContiguous = nextSlot && nextSlot - slot === SLOT_DURATION
      const timeLeftInCurrentSlot = getSlotDuration(slot)
      const nextNextSlot = futureMeeting.timeSlots[i + 2]
      const nextNextSlotContiguous = nextNextSlot && nextNextSlot - nextSlot === SLOT_DURATION
      const contiguousTime = timeLeftInCurrentSlot + (nextSlotContiguous ? (SLOT_DURATION + (nextNextSlotContiguous ? SLOT_DURATION : 0)) : 0)
      const lateAllowance = getLateAllowance(futureMeeting.minDurationM)

      // Check if this slot conflicts with user's own meetings
      const hasConflictWithMyMeetings = myOccupiedSlots.has(slot)

      const potentiallyJoinable = !isMine && contiguousTime >= futureMeeting.minDurationM * 60 * 1000 - lateAllowance
      const joinable = potentiallyJoinable && !hasConflictWithMyMeetings

      // Include in display only if not filtered out
      if (!isFilteredOut && (foundFirstJoinable || potentiallyJoinable || isMine)) {
        slot2meetingData[slot].displayMeetings.push({ meeting: futureMeeting, joinable })
        slot2meetingData[slot].totalCount++
      }

      if (joinable) {
        foundFirstJoinable = true
      }
    }
  }
  return slot2meetingData
}

/**
 * Calculate the earliest time when any meeting in the list will become unjoinable.
 * Used to schedule re-renders for timely UI updates when meetings transition from joinable to unjoinable.
 *
 * A slot becomes unjoinable when its contiguous time drops below:
 * - 30-min meetings: 30min - LATE_ALLOWANCE_FOR_HALF_HOUR_MEETING (25 min)
 * - 60-min meetings: 60min - LATE_ALLOWANCE_FOR_HOUR_MEETING (50 min)
 *
 * @param meetings Array of meetings to check (should exclude user's own meetings since they can't be "joined")
 * @returns Timestamp when the next meeting becomes unjoinable, or null if none will
 */
export function getNextUnjoinableTime(meetings: { timeSlots: number[], minDurationM: number }[]): number | null {
  const now = Date.now()
  let earliestTime: number | null = null

  for (const meeting of meetings) {
    const lateAllowance = getLateAllowance(meeting.minDurationM)
    const minRequired = meeting.minDurationM * 60 * 1000 - lateAllowance

    const sortedSlots = [...meeting.timeSlots].sort((a, b) => a - b)

    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i]
      const slotEnd = slot + SLOT_DURATION

      // Skip past slots
      if (now >= slotEnd) continue

      // Calculate contiguous end from this slot
      let contiguousEnd = slotEnd
      for (let j = i + 1; j < sortedSlots.length; j++) {
        const nextSlot = sortedSlots[j]
        if (nextSlot === contiguousEnd) {
          contiguousEnd = nextSlot + SLOT_DURATION
        } else {
          break
        }
      }

      // Calculate when this slot becomes unjoinable
      // Slot is joinable while: contiguousEnd - now >= minRequired
      // Becomes unjoinable when: now > contiguousEnd - minRequired
      const unjoinableTime = contiguousEnd - minRequired

      // Only consider if it's in the future
      if (unjoinableTime > now) {
        if (earliestTime === null || unjoinableTime < earliestTime) {
          earliestTime = unjoinableTime
        }
      }
    }
  }

  return earliestTime
}