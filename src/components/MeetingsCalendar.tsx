'use client'

import { useQuery, gql } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Meeting } from '@/generated/graphql'
import { format, setMinutes, setSeconds, setMilliseconds, addMinutes, isToday, isTomorrow } from 'date-fns'
import { Fragment } from 'react'
import { enUS } from 'date-fns/locale'

const GET_FUTURE_MEETINGS = gql`
  query GetFutureMeetings($userId: ID!) {
    getFutureMeetings(userId: $userId) {
      _id
      timeSlots
      statuses
      languages
      minDuration
    }
  }
`

function getTimeSlotsGrid(now: number, hoursAhead: number, slotDuration: number) {
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

function getDayLabel(date: Date, t: any) {
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

export default function MeetingsCalendar() {
  const t = useTranslations()
  const { currentUser } = useStore()
  const now = Date.now()
  const slotDuration = 30 * 60 * 1000 // 30 minutes in ms
  const hoursAhead = 48
  const slots = getTimeSlotsGrid(now, hoursAhead, slotDuration)

  const { data, loading, error } = useQuery(GET_FUTURE_MEETINGS, {
    variables: { userId: currentUser?._id },
    skip: !currentUser?._id
  })

  if (loading) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading calendar</Typography>

  // Map: slotTime -> meetings
  const slotMap: Record<number, Meeting[]> = {}
  for (let i = 0; i < slots.length; i++) {
    slotMap[slots[i].timestamp] = []
  }
  for (let i = 0; i < data.getFutureMeetings.length; i++) {
    const meeting = data.getFutureMeetings[i]
    for (let j = 0; j < meeting.timeSlots.length; j++) {
      const slot = meeting.timeSlots[j]
      // Snap slot to our slot grid
      const snapped = slots.find(s => Math.abs(s.timestamp - slot) < slotDuration / 2)
      if (snapped) {
        slotMap[snapped.timestamp].push(meeting)
      }
    }
  }

  // Group slots by dayKey
  const slotsByDay: Record<string, typeof slots> = {}
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    if (!slotsByDay[slot.dayKey]) slotsByDay[slot.dayKey] = []
    slotsByDay[slot.dayKey].push(slot)
  }

  return (
    <Paper className="p-4">
      <Typography variant="h6" className="mb-4">{t('futureMeetingsCalendar')}</Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell colSpan={3} padding="none">{t('timeSlot')}</TableCell>
            <TableCell>{t('meetingsCount')}</TableCell>
            <TableCell>{t('statuses')}</TableCell>
            <TableCell>{t('languages')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(slotsByDay).map(([dayKey, daySlots]) => (
            <Fragment key={dayKey}>
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="bg-gray-900 font-bold"
                  style={{ paddingTop: 4, paddingBottom: 4 }}
                >
                  <Typography
                    variant="body2"
                    className="font-bold"
                    style={{ fontWeight: 700 }}
                  >
                    {getDayLabel(new Date(dayKey), t)}
                  </Typography>
                </TableCell>
              </TableRow>
              {daySlots.map(slot => {
                const meetings = slotMap[slot.timestamp]
                // Count statuses
                const statusCounts: Record<string, number> = {}
                const languageCounts: Record<string, number> = {}
                for (let i = 0; i < meetings.length; i++) {
                  for (let j = 0; j < meetings[i].statuses.length; j++) {
                    const status = meetings[i].statuses[j]
                    if (!statusCounts[status]) statusCounts[status] = 0
                    statusCounts[status]++
                  }
                  for (let j = 0; j < meetings[i].languages.length; j++) {
                    const lang = meetings[i].languages[j]
                    if (!languageCounts[lang]) languageCounts[lang] = 0
                    languageCounts[lang]++
                  }
                }
                const startLabel = slot.isNow ? t('now') : slot.startTime
                return (
                  <TableRow key={slot.timestamp}>
                    <TableCell padding="none" style={{ width: 36, textAlign: 'center' }}>
                      {startLabel}
                    </TableCell>
                    <TableCell padding="none" style={{ width: 8, textAlign: 'center' }}>
                      -
                    </TableCell>
                    <TableCell padding="none" style={{ width: 36, textAlign: 'center' }}>
                      {slot.endTime}
                    </TableCell>
                    <TableCell style={{ width: 36, textAlign: 'center' }}>
                      {meetings.length ? meetings.length : ''}
                    </TableCell>
                    <TableCell>
                      {Object.entries(statusCounts).map(([status, count]) => (
                        <Chip
                          key={status}
                          label={`${status} (${count})`}
                          size="small"
                          className="mr-1 mb-1"
                        />
                      ))}
                    </TableCell>
                    <TableCell>
                      {Object.entries(languageCounts).map(([lang, count]) => (
                        <Chip
                          key={lang}
                          label={`${lang} (${count})`}
                          size="small"
                          className="mr-1 mb-1"
                        />
                      ))}
                    </TableCell>
                  </TableRow>
                )
              })}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </Paper>
  )
} 