'use client'

import { useStore } from '@/store/useStore'
import { Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Meeting } from '@/generated/graphql'
import { format, setMinutes, setSeconds, setMilliseconds, addMinutes, isToday, isTomorrow } from 'date-fns'
import { Fragment, useMemo } from 'react'
import { enUS } from 'date-fns/locale'
import { useMeetings } from '@/contexts/MeetingsContext'

const VERTICAL_CELL_PADDING = '0.1rem'
const HORIZONTAL_CELL_PADDING = '0.5rem'
const CELL_PADDING = `${VERTICAL_CELL_PADDING} ${HORIZONTAL_CELL_PADDING}`
const MIN_CELL_HEIGHT = '2rem'

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
  const {
    futureMeetings,
    loadingFutureMeetings,
    errorFutureMeetings,
    refetchFutureMeetings
  } = useMeetings()

  const now = Date.now()
  const slotDuration = 30 * 60 * 1000 // 30 minutes in ms
  const hoursAhead = 48
  const slots = getTimeSlotsGrid(now, hoursAhead, slotDuration)

  if (loadingFutureMeetings) return <Typography>Loading...</Typography>
  if (errorFutureMeetings) return <Typography color="error">Error loading calendar</Typography>

  // Map: slotTime -> meetings
  const slotMap: Record<number, Meeting[]> = {}
  for (let i = 0; i < slots.length; i++) {
    slotMap[slots[i].timestamp] = []
  }
  for (let i = 0; i < futureMeetings.length; i++) {
    const meeting = futureMeetings[i]
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

  // Collect all unique user IDs from all meetings in all slots
  const userIdSet = new Set<string>()
  for (let i = 0; i < slots.length; i++) {
    const meetings = slotMap[slots[i].timestamp]
    for (let j = 0; j < meetings.length; j++) {
      if (meetings[j].userId) userIdSet.add(meetings[j].userId)
    }
  }
  const userIds = Array.from(userIdSet)
  const userIdToX: Record<string, number> = {}
  for (let i = 0; i < userIds.length; i++) {
    userIdToX[userIds[i]] = i
  }

  const headerStyle = {
    fontSize: '0.8rem',
  }


  // Define grid columns: timeSlot (3), meetingsCount, timeline, statuses, languages
  const gridTemplateColumns = `
    42px 8px 42px
    30px
    70px 
    ${Math.max(userIds.length * 6 + 8, 100)}px 
    minmax(24px, 2fr) 
    minmax(24px, 1fr)
  `

  return (
    <Paper className="p-4 flex flex-col h-full">
      <Typography variant="h6" className="mb-4">{t('upcomingMeetings')}</Typography>
      {/* Header grid */}
      <div
        className="calendar-grid-header input-bg"
        style={{
          display: 'grid',
          gridTemplateColumns,
          alignItems: 'stretch',
          width: '100%',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <div style={{ gridColumn: '1 / span 3', padding: CELL_PADDING, ...headerStyle }}>
          {t('timeSlot')}
        </div>
        <div></div>
        <div style={{ fontWeight: 700, padding: CELL_PADDING, textAlign: 'center', ...headerStyle }}>
          {t('meetingsCount')}
        </div>
        <div style={{ fontWeight: 700, padding: CELL_PADDING, ...headerStyle }}>
          {/* Timeline */}
        </div>
        <div style={{ fontWeight: 700, padding: CELL_PADDING, ...headerStyle }}>
          {t('statuses')}
        </div>
        <div style={{ fontWeight: 700, padding: CELL_PADDING, ...headerStyle }}>
          {t('languages')}
        </div>
      </div>
      {/* Body grid (scrollable) */}
      <div
        className="calendar-grid-body"
        style={{
          display: 'grid',
          gridTemplateColumns,
          alignItems: 'stretch',
          width: '100%',
          overflowY: 'auto',
          flex: 1
        }}
      >
        {Object.entries(slotsByDay).map(([dayKey, daySlots]) => (
          <Fragment key={dayKey}>
            {/* Day label row (skip for today) */}
            {!isToday(new Date(dayKey)) && (
              <div
                style={{
                  gridColumn: `1 / span 8`,
                  padding: CELL_PADDING,
                  minHeight: '0.7rem',
                }}
              >
                <Typography
                  variant="body2"
                  style={{ fontWeight: 500 }}
                >
                  {getDayLabel(new Date(dayKey), t)}
                </Typography>
              </div>
            )}
            {/* Slot rows */}
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
                <Fragment key={slot.timestamp}>
                  {/* Start time */}
                  <div style={{ textAlign: 'center', minHeight: MIN_CELL_HEIGHT }}>
                    {startLabel}
                  </div>
                  {/* Dash */}
                  <div style={{ textAlign: 'center', minHeight: MIN_CELL_HEIGHT }}>
                    -
                  </div>
                  {/* End time */}
                  <div style={{ textAlign: 'center', minHeight: MIN_CELL_HEIGHT }}>
                    {slot.endTime}
                  </div>
                  <div></div>
                  {/* Meetings count */}
                  <div style={{ padding: CELL_PADDING, textAlign: 'center', minHeight: MIN_CELL_HEIGHT, whiteSpace: 'nowrap' }}>
                    {meetings.length ? meetings.length : ''}
                  </div>
                  {/* Timeline */}
                  <div
                    style={{
                      minHeight: MIN_CELL_HEIGHT,
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'stretch',
                      height: '100%',
                      position: 'relative',
                    }}
                  >
                    {userIds.map((userId, idx) => {
                      const hasMeeting = meetings.some(m => m.userId === userId)
                      return (
                        <div
                          key={userId}
                          style={{
                            width: 2,
                            height: '100%',
                            background: hasMeeting ? '#1976d2' : 'transparent',
                            marginLeft: idx === 0 ? 0 : 4,
                            borderRadius: 0,
                            transition: 'background 0.2s'
                          }}
                          title={userId}
                        />
                      )
                    })}
                  </div>
                  {/* Statuses */}
                  <div style={{ padding: CELL_PADDING, minHeight: MIN_CELL_HEIGHT, whiteSpace: 'nowrap' }}>
                    {Object.entries(statusCounts).map(([status, count]) => (
                      <Chip
                        key={status}
                        label={`${t(`Status.${status}`)} (${count})`}
                        size="small"
                        style={{ marginRight: 2, marginBottom: 2 }}
                      />
                    ))}
                  </div>
                  {/* Languages */}
                  <div style={{ padding: CELL_PADDING, minHeight: MIN_CELL_HEIGHT, whiteSpace: 'nowrap' }}>
                    {Object.entries(languageCounts).map(([lang, count]) => (
                      <Chip
                        key={lang}
                        label={`${lang} (${count})`}
                        size="small"
                        style={{ marginRight: 2, marginBottom: 2 }}
                      />
                    ))}
                  </div>
                </Fragment>
              )
            })}
          </Fragment>
        ))}
      </div>
    </Paper>
  )
} 