'use client'

import { useStore, type AppState } from '@/store/useStore'
import { Paper, Typography, Chip, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Meeting, MeetingWithPeer, MeetingTransparency } from '@/generated/graphql'
import { isToday } from 'date-fns'
import { Fragment, useRef, useState, useEffect } from 'react'
import { useMeetings } from '@/contexts/MeetingsContext'
import Link from 'next/link'
import { getMeetingColorClass, class2Hex, FINDING_MEETING_COLOR, canEditMeeting, getDayLabel, isMeetingPassed, SLOT_DURATION, getSharedInterests } from '@/utils/meetingUtils'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { getCalendarTimeSlots, prepareTimeSlotsInfos } from './MeetingsCalendarUtils'
import LoadingDialog from './LoadingDialog'
import MeetingsFilters from './MeetingsFilters'
import PageHeader from './PageHeader'
import { shallow } from 'zustand/shallow'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useRouter } from 'next/navigation'
import { isProfileComplete } from '@/utils/userUtils'
import ProfileIncompleteDialog from './ProfileIncompleteDialog'
import { NetworkStatus } from '@apollo/client'
import { useGroups } from '@/store/GroupsProvider'
import { Group } from '@/generated/graphql'
import React from 'react'

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
  filterGroups: string[];
  groups: Group[] | undefined;
  currentUser: any;
  myOccupiedSlots: Set<number>;
}

export default function MeetingsCalendar() {
  const t = useTranslations()
  const { 
    currentUser,
    appliedFilterMinDurationM,
    filterGroups,
  } = useStore((state: AppState) => ({
    currentUser: state.currentUser,
    appliedFilterMinDurationM: state.filterMinDurationM,
    filterGroups: state.filterGroups,
  }), shallow)

  const { groups } = useGroups()

  const router = useRouter()
  const [profileIncompleteDialogOpen, setProfileIncompleteDialogOpen] = useState(false)

  const { 
    futureMeetingsWithPeers, 
    loadingFutureMeetingsWithPeers, 
    errorFutureMeetingsWithPeers, 
    myMeetingsWithPeers,
    refetchFutureMeetingsWithPeers,
    networkStatusFutureMeetings
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

  // Create a set of all time slots occupied by user's own meetings for conflict detection
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
      meeting.timeSlots.forEach(timeSlot => {
        myOccupiedSlots.add(timeSlot)
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

  const isLoading = loadingFutureMeetingsWithPeers || networkStatusFutureMeetings === NetworkStatus.refetch

  if (isLoading || errorFutureMeetingsWithPeers) {
    return <LoadingDialog loading={isLoading} error={errorFutureMeetingsWithPeers} />
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
    <Paper className="flex flex-col relative h-full">
      <PageHeader
        icon={<CalendarTodayIcon />}
        title={t('upcomingMeetings')}
      >
        <IconButton
          onClick={() => {
            if (!currentUser || !isProfileComplete(currentUser)) {
              setProfileIncompleteDialogOpen(true)
              return
            }
            router.push('/meeting')
          }}
          aria-label={t('createNewMeeting')}
          title={t('createNewMeeting')}
          size="small"
        >
          <AddIcon />
        </IconButton>
        <IconButton 
            onClick={() => { if (refetchFutureMeetingsWithPeers) refetchFutureMeetingsWithPeers() }} 
            aria-label={t('refreshMeetings')} 
            title={t('refreshMeetings')} 
            size="small"
        >
          <RefreshIcon />
        </IconButton>
      </PageHeader>

      <MeetingsFilters 
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
                      filterGroups={filterGroups}
                      groups={groups}
                      currentUser={currentUser}
                      myOccupiedSlots={myOccupiedSlots}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </>
      )}
      <ProfileIncompleteDialog
        open={profileIncompleteDialogOpen}
        onClose={() => setProfileIncompleteDialogOpen(false)}
      />
    </Paper>
  )
} 

function MeetingsCalendarRow({
  slot,
  meetingsWithInfos,
  myMeetingSlotToId,
  myMeetingsWithPeers,
  t,
  slotRefs,
  filterGroups,
  groups,
  currentUser,
  myOccupiedSlots
}: MeetingsCalendarRowProps) {
  // Determine if we should group by groups
  const userAccessibleGroups = groups?.filter(group => 
    currentUser?.groups?.includes(group._id)
  ) || []
  
  const shouldGroupByGroups = 
    filterGroups.length > 1 || 
    (filterGroups.length === 0 && userAccessibleGroups.length > 1)

  // Count interests
  type InterestInfo = { 
    count: number, 
    joinableMeeting: Meeting | null, 
    hasMine: boolean, 
    groupId?: string,
    transparentMeetings: Array<{ meeting: Meeting }>
  }
  const interest2Info: Record<string, InterestInfo> = {}
  const languageCounts: Record<string, number> = {}

  for (const { meeting, joinable, isMine } of meetingsWithInfos) {
    let interests = meeting.interests
    if ( isMine && meeting.peerMeetingId ) {
      const peerMeeting = myMeetingsWithPeers.find(meetingWithPeer => meetingWithPeer.meeting._id === meeting.peerMeetingId)?.meeting
      interests = getSharedInterests(meeting, peerMeeting)
    }
    for (const interest of interests) {
      const key = shouldGroupByGroups ? `${meeting.groupId}_${interest}` : interest
      let interestInfo = interest2Info[key]
      if ( !interestInfo ) {
        interestInfo = { count: 0, joinableMeeting: null, hasMine: false, groupId: meeting.groupId, transparentMeetings: [] }
        interest2Info[key] = interestInfo
      }
      interestInfo.count++
      interestInfo.hasMine ||= isMine
      
      // Add transparent meetings
      const meetingWithTransparency = meeting as any
      if (!isMine && meetingWithTransparency.transparency === MeetingTransparency.Transparent && meeting.userName) {
        interestInfo.transparentMeetings.push({ meeting })
      }
      
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
        {(() => {
          const groupedInterests: Record<string, Array<{key: string, interest: string, info: InterestInfo}>> = {}
          
          Object.entries(interest2Info).forEach(([key, info]) => {
            const groupId = info.groupId || 'unknown'
            if (!groupedInterests[groupId]) {
              groupedInterests[groupId] = []
            }
            const interest = key.includes('_') ? key.split('_').slice(1).join('_') : key
            groupedInterests[groupId].push({ key, interest, info })
          })

          return Object.entries(groupedInterests).map(([groupId, interestEntries]) => {
            const group = groups?.find(g => g._id === groupId)
            const groupName = group?.name || t('unknownGroup')
            
            return (
              <React.Fragment key={groupId}>
                {shouldGroupByGroups && (
                  <Typography variant="body2" style={{ marginBottom: '0.2rem', width: '100%', textAlign: 'center', fontSize: '0.8rem' }}>
                    {groupName}
                  </Typography>
                )}
                {interestEntries.flatMap(({ key, interest, info }) => {
                  const { count, joinableMeeting, hasMine, transparentMeetings } = info
                  
                  const chips = []
                  
                  // Show transparent meetings individually with names
                  transparentMeetings.forEach((meetingInfo, index) => {
                    const chipLabel = `${meetingInfo.meeting.userName}: ${interest}`
                    const chipKey = `${key}-transparent-${index}`
                    chips.push({
                      chipLabel,
                      chipKey,
                      joinableMeeting: meetingInfo.meeting,
                      chipTooltipText: t('connectWithMeeting'),
                      interest
                    })
                  })
                  
                  // Show opaque meetings count (total count minus transparent count)
                  const opaqueCount = count - transparentMeetings.length
                  if (opaqueCount > 0) {
                    const chipLabel = `${interest} (${opaqueCount})`
                    const chipKey = `${key}-opaque`
                    chips.push({
                      chipLabel,
                      chipKey,
                      joinableMeeting: hasMine ? null : joinableMeeting,
                      chipTooltipText: hasMine ? t('myMeeting') : joinableMeeting ? t('connectWithMeeting') : t('pleaseSelectAnEarlierTimeSlot'),
                      interest
                    })
                  }
                  
                  return chips
                }).map(({ chipLabel, chipKey, joinableMeeting, chipTooltipText, interest }) => {
                  const chip = <Chip
                    label={chipLabel}
                    size="small"
                    key={chipKey}
                  />;
                  
                  return (
                    <Tooltip title={chipTooltipText} placement="top" key={chipKey + '-tooltip'}>
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
              </React.Fragment>
            )
          })
        })()}
      </div>
      {/* Languages */}
      <div
        style={{
          padding: CELL_PADDING,
          borderBottom: '1px solid var(--border-color)',
          gap: '0.2rem',
          flexWrap: 'wrap',
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