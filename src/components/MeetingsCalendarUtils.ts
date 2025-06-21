import { Meeting, MeetingWithPeer } from '@/generated/graphql'
import { format, setMinutes, setSeconds, setMilliseconds, isToday } from 'date-fns'
import { TimeSlot } from './TimeSlotsGrid'
import { SLOT_DURATION, getLateAllowance, getSlotDuration, isMeetingPassed } from '@/utils/meetingUtils'

export type MeetingWithInfo = {
  meeting: Meeting,
  joinable: boolean,
  isMine: boolean,
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

export function prepareTimeSlotsInfos(futureMeetings: Meeting[], slots: TimeSlot[], myMeetingsWithPeers: MeetingWithPeer[]) {
  const slot2meetingInfos: Record<number, MeetingWithInfo[]> = {}
  for (let i = 0; i < slots.length; i++) {
    slot2meetingInfos[slots[i].timestamp] = []
  }
  
  // Create a set of all time slots occupied by user's own meetings
  const myOccupiedSlots = new Set<number>()
  myMeetingsWithPeers.forEach(meetingWithPeer => {
    const meeting = meetingWithPeer.meeting
    if (isMeetingPassed(meeting)) return
    
    if (meeting.startTime) {
      // If meeting is scheduled, it occupies two slots (an hour)
      myOccupiedSlots.add(meeting.startTime)
      myOccupiedSlots.add(meeting.startTime + SLOT_DURATION)
    } else {
      // If meeting is not scheduled yet, add all its time slots
      meeting.timeSlots.forEach(slot => {
        myOccupiedSlots.add(slot)
      })
    }
  })
  
  const now = Date.now()
  for (const futureMeeting of futureMeetings) {
    if (isMeetingPassed(futureMeeting)) continue
    let foundFirstJoinable = false
    for (let i = 0; i < futureMeeting.timeSlots.length; i++) {
      const slot = futureMeeting.timeSlots[i]
      if ( slot < slots[0].timestamp ) {
        continue
      }

      const isMine = myMeetingsWithPeers.some(meetingWithPeer => meetingWithPeer.meeting._id === futureMeeting._id)
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
      if (foundFirstJoinable || potentiallyJoinable || isMine) {
        slot2meetingInfos[slot].push({ meeting: futureMeeting, joinable, isMine })
      }
      if (joinable) {
        foundFirstJoinable = true
      }
    }
  }
  return slot2meetingInfos
}