'use client'

import { useStore } from '@/store/useStore'
import { Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Meeting } from '@/generated/graphql'
import { format, setMinutes, setSeconds, setMilliseconds, isToday } from 'date-fns'
import { Fragment, useMemo, useRef, useState, useEffect } from 'react'
import { useMeetings } from '@/contexts/MeetingsContext'
import Link from 'next/link'
import { getMeetingColorClass, class2Hex, FINDING_MEETING_COLOR, canEditMeeting, getDayLabel, isMeetingPassed } from '@/utils/meetingUtils'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import { getTimeSlotsGrid } from './MeetingsCalendarUtils'

const VERTICAL_CELL_PADDING = '0.1rem'
const HORIZONTAL_CELL_PADDING = '0.5rem'
const CELL_PADDING = `${VERTICAL_CELL_PADDING} ${HORIZONTAL_CELL_PADDING}`
const MIN_CELL_HEIGHT = '2rem'

export default function MeetingsCalendar() {
  const t = useTranslations()
  const {
    futureMeetings,
    loadingFutureMeetings,
    errorFutureMeetings,
    refetchFutureMeetings,
    meetingsWithPeers
  } = useMeetings()

  const now = Date.now()
  const SLOT_DURATION = 30 * 60 * 1000 // 30 minutes in ms
  const HOURS_AHEAD = 24 * 7
  const slots = getTimeSlotsGrid(now, HOURS_AHEAD, SLOT_DURATION)

  const gridBodyRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [topDayKey, setTopDayKey] = useState<string | null>(null)

  // Collect all meetingIds for quick lookup
  const myMeetingSlotToId: Record<number, string> = {}
  meetingsWithPeers.forEach(meetingWithPeer => {
    const meeting = meetingWithPeer.meeting
    const isPassed = isMeetingPassed(meeting)
    if (isPassed) return
    if ( meeting.startTime ) {
      // if meeting is scheduled, it occupies two slots (an hour)
      myMeetingSlotToId[meeting.startTime] = meeting._id
      myMeetingSlotToId[meeting.startTime + SLOT_DURATION] = meeting._id
    } else {
      meeting.timeSlots.forEach(slot => {
        myMeetingSlotToId[slot] = meeting._id
      })
    }
  })

  // Find the first visible slot and update topDayKey
  useEffect(() => {
    const handleScroll = () => {
      if (!gridBodyRef.current) return
      const gridRect = gridBodyRef.current.getBoundingClientRect()
      let firstVisibleSlotDay: string | null = null
      for (const slot of slots) {
        const ref = slotRefs.current[slot.timestamp]
        if (ref) {
          const rect = ref.getBoundingClientRect()
          if (rect.bottom > gridRect.top + 1) { // +1 for tolerance
            firstVisibleSlotDay = slot.dayKey
            break
          }
        }
      }
      setTopDayKey(firstVisibleSlotDay)
    }
    const grid = gridBodyRef.current
    if (grid) {
      grid.addEventListener('scroll', handleScroll)
      // Initial call
      handleScroll()
    }
    return () => {
      if (grid) grid.removeEventListener('scroll', handleScroll)
    }
  }, [slots])

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
      const snapped = slots.find(s => Math.abs(s.timestamp - slot) < SLOT_DURATION / 2)
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


  // Define grid columns: timeSlot (3), meetingsCount, timeline, interests, languages
  const gridTemplateColumns = `
    110px
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
        <div style={{ padding: CELL_PADDING, ...headerStyle }}>
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
          {t('interests')}
        </div>
        <div style={{ fontWeight: 700, padding: CELL_PADDING, ...headerStyle }}>
          {t('languages')}
        </div>
      </div>
      {/* Body grid (scrollable) */}
      <div
        className="calendar-grid-body"
        ref={gridBodyRef}
        style={{
          display: 'grid',
          gridTemplateColumns,
          alignItems: 'stretch',
          width: '100%',
          overflowY: 'auto',
          flex: 1,
          position: 'relative'
        }}
      >
        {/* Absolutely positioned sticky day label */}
        {topDayKey && (
          <div className="panel-bg panel-border"
            style={{
              position: 'sticky',
              top: 0,
              left: 0,
              width: '100%',
              zIndex: 2,
              gridColumn: `1 / span 6`,
              padding: CELL_PADDING,
              minHeight: '2rem',
              borderBottomWidth: '1px'
            }}
          >
            <Typography variant="body2" style={{ }}>
              {getDayLabel(new Date(topDayKey), t)}
            </Typography>
          </div>
        )}
        {Object.entries(slotsByDay).map(([dayKey, daySlots]) => (
          <Fragment key={dayKey}>
            {/* Day label row (skip for today) */}
            {!isToday(new Date(dayKey)) && (
              <div
                style={{
                  gridColumn: `1 / span 6`,
                  padding: CELL_PADDING,
                  minHeight: '2rem',
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
              // Count interests
              const interestCounts: Record<string, number> = {}
              const languageCounts: Record<string, number> = {}
              for (let i = 0; i < meetings.length; i++) {
                for (let j = 0; j < meetings[i].interests.length; j++) {
                  const interest = meetings[i].interests[j]
                  if (!interestCounts[interest]) interestCounts[interest] = 0
                  interestCounts[interest]++
                }
                for (let j = 0; j < meetings[i].languages.length; j++) {
                  const lang = meetings[i].languages[j]
                  if (!languageCounts[lang]) languageCounts[lang] = 0
                  languageCounts[lang]++
                }
              }
              const startLabel = slot.isNow ? t('now') : slot.startTime

              // Check if this slot belongs to one of my meetings
              const myMeetingId = myMeetingSlotToId[slot.timestamp]
              const myMeeting = meetingsWithPeers.find(mwp => mwp.meeting._id === myMeetingId)?.meeting
              const meetingPassed = myMeeting && isMeetingPassed(myMeeting)
              let slotLink = `/meeting?timeslot=${slot.timestamp}`
              let tooltipText = t('createMeeting')
              let meetingColorClass = FINDING_MEETING_COLOR

              if (myMeeting && !meetingPassed) {
                meetingColorClass = getMeetingColorClass(myMeeting)
                if ( canEditMeeting(myMeeting) ) {
                  slotLink = `/meeting/${myMeetingId}`
                  tooltipText = t('editMeeting')
                } else {
                  slotLink = `list?meetingId=${myMeetingId}`
                  tooltipText = t('viewMeeting')
                }
              }
              const meetingColor = class2Hex(meetingColorClass)

              return (
                <Fragment key={slot.timestamp}>
                  {/* Attach ref to the first cell of each slot row */}
                  <div
                    ref={el => { slotRefs.current[slot.timestamp] = el }}
                    style={{
                      textAlign: 'center',
                      minHeight: MIN_CELL_HEIGHT,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                    className="calendar-timeslot-cell"
                  >
                    <Tooltip title={tooltipText} placement="left">
                      <Link
                          href={slotLink}
                          style={{
                            color: 'var(--link-color)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, }}>
                          {myMeeting && !meetingPassed ? (
                            <span className={meetingColorClass}
                              style={{ display: 'inline-block', borderRadius: '50%', width: 12, height: 12, background: meetingColor, border: `2px solid ${meetingColor}`, boxSizing: 'border-box', transition: 'background 0.2s', marginRight: 8 }} />
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, position: 'relative' }}>
                              <AddIcon className="calendar-plus" sx={{ width: 20, height: 20, color: '#1976d2', opacity: 0, transition: 'opacity 0.15s' }} />
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', color: meetingColor, justifyContent: 'center' }}>
                          <div className="min-w-10 text-center">{startLabel}</div>
                          -
                          <div className="min-w-10 text-center">{slot.endTime}</div>
                        </div>
                      </Link>
                    </Tooltip>
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
                  {/* Interests */}
                  <div style={{ padding: CELL_PADDING, minHeight: MIN_CELL_HEIGHT, whiteSpace: 'nowrap' }}>
                    {Object.entries(interestCounts).map(([interest, count]) => (
                      <Chip
                        key={interest}
                        label={`${t(`Interest.${interest}`)} (${count})`}
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