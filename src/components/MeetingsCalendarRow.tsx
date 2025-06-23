'use client'

import { Fragment } from 'react'
import { Typography, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Meeting, MeetingWithPeer, MeetingTransparency, User, Group } from '@/generated/graphql'
import Link from 'next/link'
import { getMeetingColorClass, class2Hex, FINDING_MEETING_COLOR, canEditMeeting, isMeetingPassed, SLOT_DURATION, getSharedInterests } from '@/utils/meetingUtils'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import { getCalendarTimeSlots, prepareTimeSlotsInfos } from './MeetingsCalendarUtils'
import UserAvatar from './UserAvatar'
import React from 'react'

const VERTICAL_CELL_PADDING = '0.1rem'
const HORIZONTAL_CELL_PADDING = '0.5rem'
const CELL_PADDING = `${VERTICAL_CELL_PADDING} ${HORIZONTAL_CELL_PADDING}`
const MIN_CELL_HEIGHT = '4rem'

// Meeting Chip Component
interface MeetingChipProps {
  meeting: Meeting
  user?: User
  isMyMeeting?: boolean
  isJoinable?: boolean
  chipTooltipText: string
  onUserClick?: (user: User) => void
  slot: ReturnType<typeof getCalendarTimeSlots>[0]
  group?: Group
  meetingColor?: string
  linkHref?: string
  t: (key: string, values?: Record<string, any>) => string
}

function MeetingChip({ 
  meeting, 
  user, 
  isMyMeeting = false, 
  isJoinable = false, 
  chipTooltipText, 
  onUserClick, 
  slot, 
  group,
  meetingColor,
  linkHref,
  t 
}: MeetingChipProps) {
  // Determine if meeting should show user name (transparent or group is transparent)
  const shouldShowUserName = !isMyMeeting && (
    meeting.transparency === MeetingTransparency.Transparent ||
    group?.transparency === MeetingTransparency.Transparent
  ) && meeting.userName

  // Create user tooltip content if user name is shown
  const userTooltipContent = shouldShowUserName && user ? (
    <div className="flex items-center gap-2 p-2">
      <UserAvatar 
        user={user}
        userName={meeting.userName}
        size="lg"
      />
      <div className="flex flex-col">
        <div className="font-medium text-lg">{meeting.userName}</div>
        {user.about && (
          <div className="text-sm opacity-80 max-w-xs">{user.about}</div>
        )}
      </div>
    </div>
  ) : null

  const handleUserClick = () => {
    if (user && onUserClick) {
      onUserClick(user)
    }
  }

  const chipLabel = isMyMeeting 
    ? `${t('myMeeting')}: ${meeting.interests.join(', ')}`
    : meeting.interests.join(', ')

  const chipElement = (
    <Chip
      label={
        <div className="flex items-center gap-1 p-1 flex-wrap" style={{ maxWidth: '100%', minWidth: 0 }}>
          {shouldShowUserName ? (
            <>
              <Tooltip title={userTooltipContent || chipTooltipText} placement="top">
                <span 
                  className="flex items-center gap-1 link-color font-medium cursor-pointer"
                  style={{ minWidth: 0, flex: '0 1 auto' }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (user) {
                      handleUserClick()
                    }
                  }}
                >
                  <UserAvatar 
                    user={user}
                    userName={meeting.userName}
                    size="sm"
                  />
                  <span 
                    className="overflow-hidden text-ellipsis"
                    style={{ 
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      maxWidth: '100%',
                      display: 'inline-block'
                    }}
                  >
                    {meeting.userName}
                  </span>
                </span>
              </Tooltip>
              <span style={{ flexShrink: 0 }}>:</span>
              {isJoinable ? (
                <Tooltip title={chipTooltipText} placement="top">
                  <Link 
                    href={`/meeting?meetingToConnectId=${meeting._id}&timeslot=${slot.timestamp}`}
                    className="overflow-hidden text-ellipsis link-color"
                    style={{ 
                      whiteSpace: 'nowrap', minWidth: 0, flex: '1 1 auto', textAlign: 'center'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {meeting.interests.join(', ')}
                  </Link>
                </Tooltip>
              ) : (
                <Tooltip title={chipTooltipText} placement="top">
                  <span 
                    className="overflow-hidden text-ellipsis"
                    style={{ 
                      whiteSpace: 'nowrap', minWidth: 0, flex: '1 1 auto', textAlign: 'center'
                    }}
                  >
                    {meeting.interests.join(', ')}
                  </span>
                </Tooltip>
              )}
            </>
          ) : (
            // For meetings without user name shown (opaque or my meetings)
            <Tooltip title={chipTooltipText} placement="top">
              {isJoinable && !isMyMeeting ? (
                <Link 
                  href={`/meeting?meetingToConnectId=${meeting._id}&timeslot=${slot.timestamp}`}
                  className="overflow-hidden text-ellipsis link-color"
                  style={{ 
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    maxWidth: '100%',
                    display: 'inline-block'
                  }}
                >
                  {chipLabel}
                </Link>
              ) : (
                <span 
                  className="overflow-hidden text-ellipsis"
                  style={{ 
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    maxWidth: '100%',
                    display: 'inline-block',
                    color: isMyMeeting ? meetingColor : undefined
                  }}
                >
                  {chipLabel}
                </span>
              )}
            </Tooltip>
          )}
        </div>
      }
      size="small"
      variant={isMyMeeting ? "outlined" : "filled"}
      style={{ 
        maxWidth: '100%', 
        height: 'unset',
        borderColor: isMyMeeting ? meetingColor : undefined,
        minHeight: '28px'
      }}
    />
  )

  // Wrap with Link if linkHref is provided
  return linkHref ? (
    <Link href={linkHref} className="max-w-full">
      {chipElement}
    </Link>
  ) : (
    chipElement
  )
}

// Define props for the new Row component
export interface MeetingsCalendarRowProps {
  slot: ReturnType<typeof getCalendarTimeSlots>[0];
  meetingsWithInfos: ReturnType<typeof prepareTimeSlotsInfos>[number];
  myMeetingSlotToId: Record<number, string>;
  myMeetingsWithPeers: MeetingWithPeer[];
  t: (key: string, values?: Record<string, any>) => string; // Adjust type based on your i18n setup
  slotRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  filterGroups: string[];
  groups: Group[] | undefined;
  users: User[] | undefined;
  currentUser: any;
  myOccupiedSlots: Set<number>;
  onUserClick: (user: User) => void;
}

export default function MeetingsCalendarRow({
  slot,
  meetingsWithInfos,
  myMeetingSlotToId,
  myMeetingsWithPeers,
  t,
  slotRefs,
  filterGroups,
  groups,
  users,
  currentUser,
  myOccupiedSlots,
  onUserClick
}: MeetingsCalendarRowProps) {
  // Determine if we should group by groups
  const userAccessibleGroups = groups?.filter(group => 
    currentUser?.groups?.includes(group._id)
  ) || []
  
  const shouldGroupByGroups = 
    filterGroups.length > 1 || 
    (filterGroups.length === 0 && userAccessibleGroups.length > 1)

  // Prepare meeting chips data
  const languageCounts: Record<string, number> = {}
  
  // Group meetings by group if needed
  const groupedMeetings: Record<string, typeof meetingsWithInfos> = {}
  
  for (const meetingWithInfo of meetingsWithInfos) {
    const { meeting } = meetingWithInfo
    const groupId = meeting.groupId || 'unknown'
    
    if (!groupedMeetings[groupId]) {
      groupedMeetings[groupId] = []
    }
    groupedMeetings[groupId].push(meetingWithInfo)
    
    // Count languages
    for (const language of meeting.languages) {
      if (!languageCounts[language]) languageCounts[language] = 0
      languageCounts[language]++
    }
  }
  const startLabel = slot.isNow ? t('now') : slot.startTime

  // Check if this slot belongs to one of my meetings for the time slot indicator
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
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.2rem',
          borderBottom: '1px solid var(--border-color)',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >

        {/* Meeting Chips */}
        {Object.entries(groupedMeetings).map(([groupId, meetingInfos]) => {
          const group = groups?.find(g => g._id === groupId)
          const groupName = group?.name || t('unknownGroup')
          
          return (
            <React.Fragment key={groupId}>
              {shouldGroupByGroups && (
                <Typography variant="body2" style={{ marginBottom: '0.2rem', width: '100%', textAlign: 'center', fontSize: '0.8rem' }}>
                  {groupName}
                </Typography>
              )}
              {meetingInfos.map((meetingInfo, index) => {
                const { meeting, joinable } = meetingInfo
                const chipKey = `${meeting._id}-${index}`
                const user = users?.find(u => u._id === meeting.userId)
                
                // Check if this is the current user's meeting
                const isMyMeeting = meeting.userId === currentUser?._id
                const meetingPassed = isMyMeeting && isMeetingPassed(meeting)
                
                // Skip passed meetings for current user
                if (isMyMeeting && meetingPassed) {
                  return null
                }
                
                // Determine tooltip text and link behavior
                let chipTooltipText
                let linkHref: string | undefined
                
                if (isMyMeeting) {
                  // For user's own meetings
                  if (canEditMeeting(meeting)) {
                    linkHref = `/meeting/${meeting._id}`
                    chipTooltipText = t('editMeeting')
                  } else {
                    linkHref = `list?meetingId=${meeting._id}`
                    chipTooltipText = t('viewMeeting')
                  }
                } else {
                  // For other users' meetings
                  if (joinable) {
                    chipTooltipText = t('connectWithMeeting')
                  } else if (myOccupiedSlots.has(slot.timestamp)) {
                    chipTooltipText = t('cannotJoinOwnMeetingConflict')
                  } else {
                    chipTooltipText = t('pleaseSelectAnEarlierTimeSlot')
                  }
                }
                
                return (
                  <MeetingChip
                    key={chipKey}
                    meeting={meeting}
                    user={user}
                    isMyMeeting={isMyMeeting}
                    isJoinable={joinable}
                    chipTooltipText={chipTooltipText}
                    onUserClick={onUserClick}
                    slot={slot}
                    group={group}
                    meetingColor={isMyMeeting ? class2Hex(getMeetingColorClass(meeting)) : undefined}
                    linkHref={linkHref}
                    t={t}
                  />
                )
              })}
            </React.Fragment>
          )
        })}
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