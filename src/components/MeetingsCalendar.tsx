'use client'

import { useStore, type AppState } from '@/store/useStore'
import { Paper, Typography, Chip, IconButton } from '@mui/material'
import { useTranslations, useLocale } from 'next-intl'
import { MeetingWithPeer, User } from '@/generated/graphql'
import { isToday } from 'date-fns'
import { Fragment, useRef, useState, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMeetings } from '@/contexts/MeetingsContext'
import { getDayLabel, isMeetingPassed, SLOT_DURATION } from '@/utils/meetingUtils'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import AddFab from './AddFab'
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
import { routerPush } from '@/utils/routerHelper'
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
  const locale = useLocale()
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
    networkStatusFutureMeetings,
    isUserInitiatedLoading
  } = useMeetings()

  const [filtersVisible, setFiltersVisible] = useState<boolean>(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userDetailsPopupOpen, setUserDetailsPopupOpen] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [topDayKey, setTopDayKey] = useState<string | null>(null)

  const now = Date.now()
  const HOURS_AHEAD = 24 * 7
  const slots = getCalendarTimeSlots(now, HOURS_AHEAD)

  // Prepare all data with useMemo to maintain consistent hook order
  const {
    myMeetingSlotToId,
    myOccupiedSlots,
    slot2meetingsWithInfos,
    daysArray
  } = useMemo(() => {
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

    // Prepare days array for virtualization
    const daysArray = Object.entries(slotsByDay).map(([dayKey, daySlots]) => ({
      dayKey,
      daySlots
    }))

    return {
      myMeetingSlotToId,
      myOccupiedSlots,
      slot2meetingsWithInfos,
      daysArray
    }
  }, [futureMeetingsWithPeers, myMeetingsWithPeers, currentUser, slots])

  // Set up virtualizer - must be called unconditionally
  const virtualizer = useVirtualizer({
    count: daysArray.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      // First day is partial (from now until midnight), others are full days
      // Full day = 48 slots (24 hours × 2 slots/hour) × ~64px = ~3072px
      // First day varies based on current time
      if (index === 0) {
        const firstDay = daysArray[0]
        return firstDay.daySlots.length * 64 + 32 // slots × height + day label
      }
      return 3072 // Full day estimate
    },
    overscan: 1, // Render 1 extra day above and below viewport (reduced from 2 since days are large)
  })

  // Update topDayKey based on first visible virtual item
  useEffect(() => {
    const firstVisibleItem = virtualizer.getVirtualItems()[0]
    if (firstVisibleItem) {
      const dayKey = daysArray[firstVisibleItem.index]?.dayKey
      if (dayKey) {
        setTopDayKey(dayKey)
      }
    }
  }, [virtualizer.getVirtualItems(), daysArray])

  // Show loading screen only if user-initiated or if it's the first load (initial fetch)
  const isLoading = isUserInitiatedLoading ||
                   (networkStatusFutureMeetings === NetworkStatus.loading)

  if (isLoading || errorFutureMeetingsWithPeers) {
    return <LoadingDialog loading={isLoading} error={errorFutureMeetingsWithPeers} />
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
          onClick={() => { if (refetchFutureMeetingsWithPeers) refetchFutureMeetingsWithPeers(undefined, true) }}
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
          {/* Body grid (scrollable) with virtualization */}
          <div
            className="calendar-grid-body px-2"
            ref={scrollContainerRef}
            style={{
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
                  padding: CELL_PADDING, minHeight: '2rem', borderBottomWidth: '1px'
                }}
              >
                {getDayLabel(new Date(topDayKey), t, locale)}
              </div>
            )}

            {/* Virtual container */}
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {/* Virtual items */}
              {virtualizer.getVirtualItems().map((virtualDay) => {
                const { dayKey, daySlots } = daysArray[virtualDay.index]

                return (
                  <div
                    key={virtualDay.key}
                    data-index={virtualDay.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualDay.start}px)`,
                      display: 'block',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 1fr',
                        alignItems: 'stretch',
                      }}
                    >
                      {/* Day label row (skip for today) */}
                      {!isToday(new Date(dayKey)) && (
                        <div style={{ gridColumn: '1 / span 2', padding: CELL_PADDING, minHeight: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                          {getDayLabel(new Date(dayKey), t, locale)}
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
                    </div>
                  </div>
                )
              })}
            </div>
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
      <AddFab
        onClick={() => {
          if (!currentUser || !isProfileComplete(currentUser)) {
            setProfileIncompleteDialogOpen(true)
            return
          }
          routerPush(router, '/meeting', {
            source: 'meetings_calendar_fab_button',
            userComplete: isProfileComplete(currentUser)
          })
        }}
        ariaLabel={t('createNewMeeting')}
        title={t('createNewMeeting')}
      />
    </Paper>
  )
} 
