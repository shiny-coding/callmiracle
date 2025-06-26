'use client'

import { useStore, type AppState } from '@/store/useStore'
import { Paper, Typography, Chip, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import { MeetingWithPeer, User } from '@/generated/graphql'
import { isToday } from 'date-fns'
import { Fragment, useRef, useState, useEffect } from 'react'
import { useMeetings } from '@/contexts/MeetingsContext'
import { getDayLabel, isMeetingPassed, SLOT_DURATION } from '@/utils/meetingUtils'
import AddIcon from '@mui/icons-material/Add'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { getCalendarTimeSlots, prepareTimeSlotsInfos } from './MeetingsCalendarUtils'
import React from 'react'
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
import UserDetailsPopup from './UserDetailsPopup'
import { useUsers } from '@/store/UsersProvider'
import MeetingsCalendarRow from './MeetingsCalendarRow'

const VERTICAL_CELL_PADDING = '0.1rem'
const HORIZONTAL_CELL_PADDING = '0.5rem'
const CELL_PADDING = `${VERTICAL_CELL_PADDING} ${HORIZONTAL_CELL_PADDING}`
const MIN_CELL_HEIGHT = '4rem'

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
  const { users } = useUsers()

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
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userDetailsPopupOpen, setUserDetailsPopupOpen] = useState(false)

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
    currentUser!
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

  const handleUserClick = (user: User) => {
    setSelectedUser(user)
    setUserDetailsPopupOpen(true)
  }

  const handleCloseUserDetails = () => {
    setUserDetailsPopupOpen(false)
    setSelectedUser(null)
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
              gridTemplateColumns: '80px 1fr',
              alignItems: 'stretch',
              width: '100%',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              paddingRight: '0.8rem',
            }}
          >
            <div style={{ padding: CELL_PADDING, ...headerStyle }}>{t('time')}</div>
            <div style={{ padding: CELL_PADDING, ...headerStyle }}>{t('interests')}</div>
          </div>
          {/* Body grid (scrollable) */}
          <div
            className="calendar-grid-body px-2"
            ref={gridBodyRef}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              alignItems: 'stretch',
              width: '100%',
              overflowY: 'auto',
              flex: 1,
              position: 'relative'
            }}
          >
            {/* Absolutely positioned sticky day label */}
            {topDayKey && (
              <div className="normal-bg panel-border"
                style={{
                  position: 'sticky', top: 0, left: 0, width: '100%', zIndex: 2,
                  gridColumn: '1 / span 2', padding: CELL_PADDING, minHeight: '2rem', borderBottomWidth: '1px'
                }}
              >
                {getDayLabel(new Date(topDayKey), t)}
              </div>
            )}
            {Object.entries(slotsByDay).map(([dayKey, daySlots]) => (
              <Fragment key={dayKey}>
                {/* Day label row (skip for today) */}
                {!isToday(new Date(dayKey)) && (
                  <div style={{ gridColumn: '1 / span 2', padding: CELL_PADDING, minHeight: '2rem', borderBottom: '1px solid var(--border-color)' }}>
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
                      users={users}
                      currentUser={currentUser}
                      myOccupiedSlots={myOccupiedSlots}
                      onUserClick={handleUserClick}
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
      {selectedUser && (
        <UserDetailsPopup
          user={selectedUser}
          open={userDetailsPopupOpen}
          onClose={handleCloseUserDetails}
        />
      )}
    </Paper>
  )
} 
