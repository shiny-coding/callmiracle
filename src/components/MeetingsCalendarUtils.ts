
import { Meeting, MeetingWithPeer } from '@/generated/graphql'
import { format, setMinutes, setSeconds, setMilliseconds, isToday } from 'date-fns'
import { TimeSlot } from './TimeSlotsGrid'
import { SLOT_DURATION, getSlotDuration } from '@/utils/meetingUtils'

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



export function prepareTimeSlotsInfos(futureMeetings: Meeting[], slots: TimeSlot[], meetingsWithPeers: MeetingWithPeer[], minDurationM: number) {
  const slot2meetingInfos: Record<number, MeetingWithInfo[]> = {}
  for (let i = 0; i < slots.length; i++) {
    slot2meetingInfos[slots[i].timestamp] = []
  }
  const now = Date.now()
  for (const futureMeeting of futureMeetings) {
    let foundFirstJoinable = false
    for (let j = 0; j < futureMeeting.timeSlots.length; j++) {
      const slot = futureMeeting.timeSlots[j]
      if ( slot < slots[0].timestamp ) {
        continue
      }

      const isMine = meetingsWithPeers.some(meetingWithPeer => meetingWithPeer.meeting._id === futureMeeting._id)
      const nextSlot = futureMeeting.timeSlots[j + 1]
      const nextSlotContiguous = nextSlot && nextSlot - slot === SLOT_DURATION
      const timeLeftInCurrentSlot = getSlotDuration(slot)
      const nextNextSlot = futureMeeting.timeSlots[j + 2]
      const nextNextSlotContiguous = nextNextSlot && nextNextSlot - nextSlot === SLOT_DURATION
      const contiguousTime = timeLeftInCurrentSlot + (nextSlotContiguous ? (SLOT_DURATION + (nextNextSlotContiguous ? SLOT_DURATION : 0)) : 0)
      const joinable = !isMine && contiguousTime >= minDurationM * 60 * 1000

      if (foundFirstJoinable || joinable || isMine) {
        slot2meetingInfos[slot].push({ meeting: futureMeeting, joinable, isMine })
      }
      if (joinable) {
        foundFirstJoinable = true
      }
    }
  }
  return slot2meetingInfos
}