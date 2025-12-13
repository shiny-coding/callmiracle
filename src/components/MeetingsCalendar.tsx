'use client'

import { useStore, type AppState } from '@/store/useStore'
import { Paper, Typography, Chip } from '@mui/material'
import { useTranslations, useLocale } from 'next-intl'
import { MeetingWithPeer, User } from '@/generated/graphql'
import { isToday } from 'date-fns'
import { Fragment, useRef, useState, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMeetings } from '@/contexts/MeetingsContext'
import { getDayLabel, isMeetingPassed, SLOT_DURATION, getMeetingColorClass, getOccupiedSlotsForMatchedMeeting } from '@/utils/meetingUtils'
import clientLogger from '@/utils/clientLogger'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import AddFab from './AddFab'
import { getCalendarTimeSlots, prepareTimeSlotsInfos, getNextUnjoinableTime } from './MeetingsCalendarUtils'
import React from 'react'
import LoadingDialog from './LoadingDialog'
import MeetingsFilters from './MeetingsFilters'
import PageHeader from './PageHeader'
import { shallow } from 'zustand/shallow'
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
  const [slotRefreshKey, setSlotRefreshKey] = useState(0)

  // Calculate time until next slot boundary and set up auto-refresh
  useEffect(() => {
    const now = Date.now()
    const nowDate = new Date(now)
    const minutes = nowDate.getMinutes()
    const seconds = nowDate.getSeconds()
    const milliseconds = nowDate.getMilliseconds()

    // Calculate milliseconds until next half-hour boundary
    const minutesUntilNextSlot = minutes < 30 ? (30 - minutes) : (60 - minutes)
    const msUntilNextSlot = (minutesUntilNextSlot * 60 - seconds) * 1000 - milliseconds + 100 // +100ms buffer

    const timer = setTimeout(() => {
      // Trigger re-render to recalculate slots
      setSlotRefreshKey(prev => prev + 1)
    }, msUntilNextSlot)

    return () => clearTimeout(timer)
  }, [slotRefreshKey])

  // Set up timer to refresh when a meeting becomes unjoinable (based on late allowance thresholds)
  // This ensures UI updates precisely when meetings transition from joinable to unjoinable
  useEffect(() => {
    // Only consider other users' meetings (can't join own meetings)
    const otherUsersMeetings = futureMeetingsWithPeers
      .filter(mwp => mwp.meeting.userId !== currentUser?._id && !isMeetingPassed(mwp.meeting))
      .map(mwp => mwp.meeting)

    const nextUnjoinableTime = getNextUnjoinableTime(otherUsersMeetings)

    if (nextUnjoinableTime === null) {
      return
    }

    const now = Date.now()
    const msUntilUnjoinable = nextUnjoinableTime - now + 100 // +100ms buffer

    if (msUntilUnjoinable <= 0) {
      return
    }

    const timer = setTimeout(() => {
      // Trigger re-render to update joinability status
      setSlotRefreshKey(prev => prev + 1)
    }, msUntilUnjoinable)

    return () => clearTimeout(timer)
  }, [futureMeetingsWithPeers, currentUser?._id, slotRefreshKey])

  const now = Date.now()
  const HOURS_AHEAD = 24 * 7
  const slots = getCalendarTimeSlots(now, HOURS_AHEAD)

  // Prepare all data with useMemo to maintain consistent hook order
  const {
    myMeetingSlotToId,
    myOccupiedSlots,
    slot2meetingData,
    daysArray,
    dayMeetingCounts
  } = useMemo(() => {
    // Log all meetings for debugging
    clientLogger.info('Meetings', 'Processing meetings', {
      myMeetingsCount: myMeetingsWithPeers.length,
      futureMeetingsCount: futureMeetingsWithPeers.length,
      now: Date.now(),
      nowISO: new Date().toISOString()
    })

    myMeetingsWithPeers.forEach((mwp, idx) => {
      const m = mwp.meeting
      const isPassed = isMeetingPassed(m)
      const colorClass = getMeetingColorClass(m)
      clientLogger.info('Meetings', `myMeeting[${idx}]`, {
        _id: m._id,
        status: m.status,
        startTime: m.startTime,
        startTimeISO: m.startTime ? new Date(m.startTime).toISOString() : null,
        lastCallTime: m.lastCallTime,
        timeSlots: m.timeSlots,
        isMeetingPassed: isPassed,
        colorClass
      })
    })

    futureMeetingsWithPeers.forEach((mwp, idx) => {
      const m = mwp.meeting
      const isPassed = isMeetingPassed(m)
      const colorClass = getMeetingColorClass(m)
      clientLogger.info('Meetings', `futureMeeting[${idx}]`, {
        _id: m._id,
        status: m.status,
        startTime: m.startTime,
        startTimeISO: m.startTime ? new Date(m.startTime).toISOString() : null,
        lastCallTime: m.lastCallTime,
        timeSlots: m.timeSlots,
        filteredOut: mwp.filteredOut,
        isMeetingPassed: isPassed,
        colorClass
      })
    })

    // Collect all meetingIds for quick lookup
    const myMeetingSlotToId: Record<number, string> = {}
    myMeetingsWithPeers.forEach(meetingWithPeer => {
      const meeting = meetingWithPeer.meeting
      if (isMeetingPassed(meeting)) return

      if (meeting.startTime) {
        // For matched meetings, only map occupied slots (based on actual startTime)
        getOccupiedSlotsForMatchedMeeting(meeting.startTime, meeting.minDurationM).forEach(slot => {
          myMeetingSlotToId[slot] = meeting._id
        })
      } else {
        // For seeking meetings, map all timeSlots
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
        // For matched meetings, use utility function to get occupied slots
        getOccupiedSlotsForMatchedMeeting(meeting.startTime, meeting.minDurationM).forEach(slot => {
          myOccupiedSlots.add(slot)
        })
      } else {
        // For seeking meetings, add all timeSlots
        meeting.timeSlots.forEach(timeSlot => {
          myOccupiedSlots.add(timeSlot)
        })
      }
    })

    // Map: slotTime -> meeting data (displayable meetings + total count)
    const slot2meetingData = prepareTimeSlotsInfos(
      futureMeetingsWithPeers,
      slots,
      myMeetingsWithPeers,
      currentUser!
    )

    // Group slots by dayKey and skip empty slots, also calculate day meeting counts
    const slotsByDay: Record<string, typeof slots> = {}
    const dayMeetingCounts: Record<string, number> = {}
    const dayMeetingIds: Record<string, Set<string>> = {}

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const slotData = slot2meetingData[slot.timestamp]

      // Skip empty slots
      if (slotData.totalCount === 0) {
        continue
      }

      if (!slotsByDay[slot.dayKey]) slotsByDay[slot.dayKey] = []
      slotsByDay[slot.dayKey].push(slot)

      // Track unique meeting IDs per day for accurate counting
      if (!dayMeetingIds[slot.dayKey]) {
        dayMeetingIds[slot.dayKey] = new Set<string>()
      }

      // Add all meeting IDs from this slot
      slotData.displayMeetings.forEach(meetingWithInfo => {
        dayMeetingIds[slot.dayKey].add(meetingWithInfo.meeting._id)
      })
    }

    // Calculate unique meeting counts per day
    Object.keys(dayMeetingIds).forEach(dayKey => {
      dayMeetingCounts[dayKey] = dayMeetingIds[dayKey].size
    })

    // Prepare days array for virtualization
    const daysArray = Object.entries(slotsByDay).map(([dayKey, daySlots]) => ({
      dayKey,
      daySlots
    }))

    return {
      myMeetingSlotToId,
      myOccupiedSlots,
      slot2meetingData,
      daysArray,
      dayMeetingCounts
    }
  }, [futureMeetingsWithPeers, myMeetingsWithPeers, currentUser, slots])

  // Set up virtualizer - must be called unconditionally
  const virtualizer = useVirtualizer({
    count: daysArray.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const day = daysArray[index]
      if (!day) return 64

      // Calculate based on actual number of slots in this day
      // Each slot is approximately 64px
      const dayLabelHeight = index === 0 || !isToday(new Date(day.dayKey)) ? 32 : 0
      return day.daySlots.length * 64 + dayLabelHeight
    },
    overscan: 1, // Render 1 extra day above and below viewport (reduced from 2 since days are large)
  })

  // Update topDayKey based on scroll position
  useEffect(() => {
    const virtualItems = virtualizer.getVirtualItems()
    const scrollOffset = virtualizer.scrollOffset || 0

    // Find the day that is at the top of the viewport (at scrollOffset)
    let topDayIndex = 0
    for (let i = 0; i < virtualItems.length; i++) {
      const item = virtualItems[i]
      if (item.start <= scrollOffset && item.end > scrollOffset) {
        topDayIndex = item.index
        break
      }
    }

    const dayKey = daysArray[topDayIndex]?.dayKey
    if (dayKey && dayKey !== topDayKey) {
      setTopDayKey(dayKey)
    }
  }, [virtualizer.range, virtualizer.scrollOffset, daysArray])

  // Show loading screen only if user-initiated or if it's the first load (initial fetch)
  const isLoading = isUserInitiatedLoading ||
                   (networkStatusFutureMeetings === NetworkStatus.loading)

  if (isLoading || errorFutureMeetingsWithPeers) {
    return <LoadingDialog loading={isLoading} error={errorFutureMeetingsWithPeers} />
  }

  // Collect all unique user IDs from all meetings in all slots
  const userIdSet = new Set<string>(
    slots.map(slot => slot2meetingData[slot.timestamp].displayMeetings.map(meetingWithJoinable => meetingWithJoinable.meeting.userId)).flat()
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
        icon={<CalendarTodayIcon className="dimmer-text-color" />}
        title={t('upcomingMeetings')}
      />

      <MeetingsFilters
        onToggleFilters={setFiltersVisible}
        />

      {/* Conditional Grid Display: Only show if filters have NOT changed */}
      {!filtersVisible && (
        <>
          {/* Header grid */}
          <div
            className="calendar-grid-header px-2"
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
              <div
                className="calendar-day-label"
                style={{ position: 'sticky', top: 0, left: 0, width: '100%', zIndex: 2 }}
              >
                <span>{getDayLabel(new Date(topDayKey), t, locale)}</span>
                {dayMeetingCounts[topDayKey] > 0 && (
                  <Chip
                    label={t('meetingCount', { count: dayMeetingCounts[topDayKey] })}
                    size="small"
                    style={{
                      fontSize: '0.75rem',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)',
                      padding: '0.25rem 0.25rem',
                    }}
                  />
                )}
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
                      {/* Day label row (skip for today and when matching sticky header) */}
                      {!isToday(new Date(dayKey)) && dayKey !== topDayKey && (
                        <div
                          className="calendar-day-label"
                          style={{ gridColumn: '1 / span 2' }}
                        >
                          <span>{getDayLabel(new Date(dayKey), t, locale)}</span>
                          {dayMeetingCounts[dayKey] > 0 && (
                            <Chip
                              label={t('meetingCount', { count: dayMeetingCounts[dayKey] })}
                              size="small"
                              style={{
                                fontSize: '0.75rem',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-color)',
                                padding: '0.25rem 0.25rem',
                              }}
                            />
                          )}
                        </div>
                      )}
                      {/* Slot rows */}
                      {daySlots.map((slot) => {
                        const meetingData = slot2meetingData[slot.timestamp]
                        return (
                          <MeetingsCalendarRow
                            key={slot.timestamp}
                            slot={slot}
                            meetingsWithInfos={meetingData.displayMeetings}
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
      {!filtersVisible && (
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
      )}
    </Paper>
  )
} 
