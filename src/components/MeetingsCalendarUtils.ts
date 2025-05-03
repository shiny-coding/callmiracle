
import { format, setMinutes, setSeconds, setMilliseconds, isToday } from 'date-fns'

export function getTimeSlotsGrid(now: number, hoursAhead: number, slotDuration: number) {
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
  for (let t = firstSlotStart.getTime(); t < end; t += slotDuration) {
    const slotStart = new Date(t)
    const slotEnd = new Date(t + slotDuration)
    slots.push({
      timestamp: t,
      startTime: format(slotStart, 'HH:mm'),
      endTime: format(slotEnd, 'HH:mm'),
      isNow: t <= now && now < t + slotDuration,
      dayKey: format(slotStart, 'yyyy-MM-dd'),
      dayLabel: isToday(slotStart)
        ? `Today (${format(slotStart, 'EEE, yyyy-MM-dd')})`
        : format(slotStart, 'EEE, yyyy-MM-dd')
    })
  }
  return slots
}
