'use client'

import { useStore, type AppState } from '@/store/useStore'
import { Paper, Typography, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Interest, Meeting, MeetingWithPeer } from '@/generated/graphql'
import { format, setMinutes, setSeconds, setMilliseconds, isToday } from 'date-fns'
import { Fragment, useMemo, useRef, useState, useEffect } from 'react'
import { useMeetings } from '@/contexts/MeetingsContext'
import Link from 'next/link'
import { getMeetingColorClass, class2Hex, FINDING_MEETING_COLOR, canEditMeeting, getDayLabel, isMeetingPassed, SLOT_DURATION, getNonBlockedInterests, getInterestsOverlap } from '@/utils/meetingUtils'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import { getCalendarTimeSlots, prepareTimeSlotsInfos } from './MeetingsCalendarUtils'
import LoadingDialog from './LoadingDialog'
import MeetingsFilters from './MeetingsFilters'
import { shallow } from 'zustand/shallow'

const VERTICAL_CELL_PADDING = '0.1rem'
const HORIZONTAL_CELL_PADDING = '0.5rem'
const CELL_PADDING = `${VERTICAL_CELL_PADDING} ${HORIZONTAL_CELL_PADDING}`
const MIN_CELL_HEIGHT = '4rem'

// Define props for the new Row component
interface MeetingsCalendarRowProps {
  slot: ReturnType<typeof getCalendarTimeSlots>[0];
  meetingsWithInfos: ReturnType<typeof prepareTimeSlotsInfos>[number];
  myMeetingSlotToId: Record<number, string>;
  myMeetingsWithPeers: MeetingWithPeer[];
  t: (key: string, values?: Record<string, any>) => string; // Adjust type based on your i18n setup
  slotRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
}

export default function MeetingsCalendar() {
  const t = useTranslations()
  const { 
    currentUser,
    appliedFilterMinDurationM,
  } = useStore((state: AppState) => ({
    currentUser: state.currentUser,
    appliedFilterMinDurationM: state.filterMinDurationM,
  }), shallow)

  const { 
    futureMeetingsWithPeers, 
    loadingFutureMeetingsWithPeers, 
    errorFutureMeetingsWithPeers, 
    myMeetingsWithPeers,
    refetchFutureMeetingsWithPeers
  } = useMeetings()

  const [filtersVisible, setFiltersVisible] = useState<boolean>(false)

  const now = Date.now()
  const HOURS_AHEAD = 24 * 7
  const slots = getCalendarTimeSlots(now, HOURS_AHEAD)

  const gridBodyRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [topDayKey, setTopDayKey] = useState<string | null>(null)

  // Collect all meetingIds for quick lookup
  const myMeetingSlotToId: Record<number, string> = {}
  myMeetingsWithPeers.forEach(meetingWithPeer => {
    const meeting = meetingWithPeer.meeting
    const isPassed = isMeetingPassed(meeting)
    if (isPassed) return
    if (meeting.startTime) {
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

  if (loadingFutureMeetingsWithPeers || errorFutureMeetingsWithPeers) {
    return <LoadingDialog loading={loadingFutureMeetingsWithPeers} error={errorFutureMeetingsWithPeers} />
  }

  // Map: slotTime -> meetings
  const slot2meetingsWithInfos = prepareTimeSlotsInfos(
    futureMeetingsWithPeers.map(meetingWithPeer => meetingWithPeer.meeting),
    slots,
    myMeetingsWithPeers,
    appliedFilterMinDurationM
  )

  // Group slots by dayKey
  const slotsByDay: Record<string, typeof slots> = {}
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    if (!slotsByDay[slot.dayKey]) slotsByDay[slot.dayKey] = []
    slotsByDay[slot.dayKey].push(slot)
  }

  // Collect all unique user IDs from all meetings in all slots
  const userIdSet = new Set<string>(
    slots.map(slot => slot2meetingsWithInfos[slot.timestamp].map(meetingWithJoinable => meetingWithJoinable.meeting.userId)).flat()
  )

  const userIds = Array.from(userIdSet)
  const userIdToX: Record<string, number> = {}
  for (let i = 0; i < userIds.length; i++) {
    userIdToX[userIds[i]] = i
  }

  const headerStyle = {
    fontSize: '0.8rem',
  }

  return (
    <Paper className="flex flex-col relative h-full" sx={{ paddingTop: '0.5rem' }}>
      <Typography variant="h6" sx={{ marginBottom: '0.5rem', paddingLeft: 'var(--16sp)' }}>{t('upcomingMeetings')}</Typography>

      <MeetingsFilters 
        onApplyFilters={() => {
          if (refetchFutureMeetingsWithPeers) {
            refetchFutureMeetingsWithPeers()
          }
        }}
        onToggleFilters={setFiltersVisible}
        />

      {/* Conditional Grid Display: Only show if filters have NOT changed */}
      {!filtersVisible && (
        <>
          {/* Header grid */}
          <div
            className="calendar-grid-header input-bg px-2"
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 10fr 80px',
              alignItems: 'stretch',
              width: '100%',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              paddingRight: '0.8rem',
            }}
          >
            <div style={{ padding: CELL_PADDING, ...headerStyle }}>{t('timeSlot')}</div>
            <div style={{ padding: CELL_PADDING, ...headerStyle }}>{t('interests')}</div>
            <div style={{ padding: CELL_PADDING, ...headerStyle, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {t('languages')}
            </div>
          </div>
          {/* Body grid (scrollable) */}
          <div
            className="calendar-grid-body px-2"
            ref={gridBodyRef}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 10fr 80px',
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
                  position: 'sticky', top: 0, left: 0, width: '100%', zIndex: 2,
                  gridColumn: '1 / span 3', padding: CELL_PADDING, minHeight: '2rem', borderBottomWidth: '1px'
                }}
              >
                {getDayLabel(new Date(topDayKey), t)}
              </div>
            )}
            {Object.entries(slotsByDay).map(([dayKey, daySlots]) => (
              <Fragment key={dayKey}>
                {/* Day label row (skip for today) */}
                {!isToday(new Date(dayKey)) && (
                  <div style={{ gridColumn: '1 / span 3', padding: CELL_PADDING, minHeight: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                    {getDayLabel(new Date(dayKey), t)}
                  </div>
                )}
                {/* Slot rows */}
                {daySlots.map((slot) => {
                  const meetingsWithInfos = slot2meetingsWithInfos[slot.timestamp]
                  return (
                    <MeetingsCalendarRow
                      key={slot.timestamp}
                      slot={slot}
                      meetingsWithInfos={meetingsWithInfos}
                      myMeetingSlotToId={myMeetingSlotToId}
                      myMeetingsWithPeers={myMeetingsWithPeers}
                      t={t}
                      slotRefs={slotRefs}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </>
      )}
    </Paper>
  )
} 

function MeetingsCalendarRow({
  slot,
  meetingsWithInfos,
  myMeetingSlotToId,
  myMeetingsWithPeers,
  t,
  slotRefs
}: MeetingsCalendarRowProps) {
  // Count interests
  type InterestInfo = { count: number, joinableMeeting: Meeting | null, hasMine: boolean }
  const interest2Info: Record<string, InterestInfo> = {}
  const languageCounts: Record<string, number> = {}

  for (const { meeting, joinable, isMine } of meetingsWithInfos) {
    let interests = meeting.interests
    if ( isMine && meeting.peerMeetingId ) {
      const peerMeeting = myMeetingsWithPeers.find(meetingWithPeer => meetingWithPeer.meeting._id === meeting.peerMeetingId)?.meeting
      interests = getInterestsOverlap(meeting.interests, peerMeeting?.interests as Interest[])
    }
    for (const interest of interests) {
      let interestInfo = interest2Info[interest]
      if ( !interestInfo ) {
        interestInfo = { count: 0, joinableMeeting: null, hasMine: false }
        interest2Info[interest] = interestInfo
      }
      interestInfo.count++
      interestInfo.hasMine ||= isMine
      if (joinable) {
        // we select oldest joinable meeting for each interest
        if (!interestInfo.joinableMeeting ||
          interestInfo.joinableMeeting.createdAt < meeting.createdAt) {
          interestInfo.joinableMeeting = meeting
        }
      }
    }
    for (const language of meeting.languages) {
      if (!languageCounts[language]) languageCounts[language] = 0
      languageCounts[language]++
    }
  }
  const startLabel = slot.isNow ? t('now') : slot.startTime

  // Check if this slot belongs to one of my meetings
  const myMeetingId = myMeetingSlotToId[slot.timestamp]
  const myMeeting = myMeetingsWithPeers.find(meetingWithPeer => meetingWithPeer.meeting._id === myMeetingId)?.meeting
  const meetingPassed = myMeeting && isMeetingPassed(myMeeting)
  const slotLink = `/meeting?timeslot=${slot.timestamp}`
  let tooltipText = t('createMeeting')
  let meetingColorClass = FINDING_MEETING_COLOR
  let timeSlotLink = slotLink;

  if (myMeeting && !meetingPassed) {
    meetingColorClass = getMeetingColorClass(myMeeting)
    if ( canEditMeeting(myMeeting) ) {
      timeSlotLink = `/meeting/${myMeetingId}`
      tooltipText = t('editMeeting')
    } else {
      timeSlotLink = `list?meetingId=${myMeetingId}`
      tooltipText = t('viewMeeting')
    }
  }
  const meetingColor = class2Hex(meetingColorClass)

  return (
    <Fragment>
      {/* Attach ref to the first cell of each slot row */}
      <div
        ref={el => { slotRefs.current[slot.timestamp] = el }}
        style={{
          minHeight: MIN_CELL_HEIGHT,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          borderBottom: '1px solid var(--border-color)'
        }}
        className="calendar-timeslot-cell"
      >
        <Tooltip title={tooltipText} placement="left">
          <Link
              href={timeSlotLink}
              style={{
                color: 'var(--link-color)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, }}>
              {myMeeting && !meetingPassed ? (
                <span className={meetingColorClass}
                  style={{ display: 'inline-block', borderRadius: '50%', width: 12, height: 12, background: meetingColor, border: `2px solid ${meetingColor}`, boxSizing: 'border-box', transition: 'background 0.2s' }} />
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <AddIcon className="calendar-plus" sx={{ width: 20, height: 20, color: '#1976d2', opacity: 0, transition: 'opacity 0.15s' }} />
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', color: meetingColor, justifyContent: 'center' }}>
              <div className="min-w-8 px-4sp text-center">{startLabel}</div>
              -
              <div className="min-w-8 px-4sp text-center">{slot.endTime}</div>
            </div>
            <div className="count-badge w-full h-5">{meetingsWithInfos.length ? `(${meetingsWithInfos.length})` : null}</div>
          </Link>
        </Tooltip>
      </div>
      {/* Interests */}
      <div
        style={{
          padding: `0.3rem ${HORIZONTAL_CELL_PADDING}`,
          flexWrap: 'wrap',
          gap: '0.2rem',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        {Object.entries(interest2Info).map(([interest, { count, joinableMeeting, hasMine }]) => {
          const chip = <Chip
            label={`${t(`Interest.${interest}`)} (${count})`}
            size="small"
            key={interest}
          />;
          let chipTooltipText;
          if (joinableMeeting) {
            chipTooltipText = t('connectWithMeeting');
          } else if (hasMine) {
            chipTooltipText = t('myMeeting');
          } else {
            chipTooltipText = t('pleaseSelectAnEarlierTimeSlot');
          }
          return (
            <Tooltip title={chipTooltipText} placement="top" key={interest + '-tooltip'}>
              {joinableMeeting ? (
                <Link href={`/meeting?meetingToConnectId=${joinableMeeting?._id}&timeslot=${slot.timestamp}&interest=${interest}`}>
                  {chip}
                </Link>
              ) : (
                chip
              )}
            </Tooltip>
          );
        })}
      </div>
      {/* Languages */}
      <div
        style={{
          padding: CELL_PADDING,
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        {Object.entries(languageCounts).map(([lang, count]) => (
          <Chip
            key={lang}
            label={`${lang} (${count})`}
            size="small"
          />
        ))}
      </div>
    </Fragment>
  )
}