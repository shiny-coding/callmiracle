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

  for (const { meeting, joinable } of meetingsWithInfos) {
    const interests = meeting.interests
    for (const interest of interests) {
      const key = shouldGroupByGroups ? `${meeting.groupId}_${interest}` : interest
      let interestInfo = interest2Info[key]
      if ( !interestInfo ) {
        interestInfo = { count: 0, joinableMeeting: null, hasMine: false, groupId: meeting.groupId, transparentMeetings: [] }
        interest2Info[key] = interestInfo
      }
      interestInfo.count++
      
      // Add transparent meetings
      const meetingWithTransparency = meeting as any
      if (meetingWithTransparency.transparency === MeetingTransparency.Transparent && meeting.userName) {
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
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.2rem',
          borderBottom: '1px solid var(--border-color)',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        {/* My Meeting Chip */}
        {myMeeting && !meetingPassed && (
          <Tooltip title={tooltipText} placement="top">
            <Link href={timeSlotLink}>
              <Chip
                label={
                  <span style={{ color: meetingColor }}>
                    {t('myMeeting')}: {myMeeting.interests.join(', ')}
                  </span>
                }
                size="small"
                variant="outlined"
                style={{ borderColor: meetingColor, minHeight: '28px' }}
              />
            </Link>
          </Tooltip>
        )}
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
                    const chipKey = `${key}-transparent-${index}`
                    const meeting = meetingInfo.meeting
                    const user = users?.find(u => u._id === meeting.userId)
                    
                    // Determine tooltip text with proper occupied slots logic
                    let meetingTooltipText
                    if (myOccupiedSlots.has(slot.timestamp)) {
                      meetingTooltipText = t('cannotJoinOwnMeetingConflict')
                    } else {
                      meetingTooltipText = t('connectWithMeeting')
                    }
                    
                    chips.push({
                      chipKey,
                      joinableMeeting: meeting,
                      chipTooltipText: meetingTooltipText,
                      interest,
                      user,
                      userName: meeting.userName,
                      isTransparent: true,
                      opaqueCount: undefined
                    })
                  })
                  
                  // Show opaque meetings count (total count minus transparent count)
                  const opaqueCount = count - transparentMeetings.length
                  if (opaqueCount > 0) {
                    const chipKey = `${key}-opaque`
                    
                    // Determine tooltip text with proper occupied slots logic
                    let meetingTooltipText
                    if (joinableMeeting) {
                      meetingTooltipText = t('connectWithMeeting')
                    } else if (myOccupiedSlots.has(slot.timestamp)) {
                      meetingTooltipText = t('cannotJoinOwnMeetingConflict')
                    } else {
                      meetingTooltipText = t('pleaseSelectAnEarlierTimeSlot')
                    }
                    
                    chips.push({
                      chipKey,
                      joinableMeeting: joinableMeeting,
                      chipTooltipText: meetingTooltipText,
                      interest,
                      opaqueCount,
                      isTransparent: false,
                      user: undefined,
                      userName: undefined
                    })
                  }
                  
                  return chips
                }).map((chipData) => {
                  const { chipKey, joinableMeeting, chipTooltipText, interest, isTransparent, user, userName, opaqueCount } = chipData
                  
                  const CustomChip = ({ onClick }: { onClick?: () => void }) => (
                    <Chip
                      label={
                        <div className="flex items-center gap-1 p-1 flex-wrap" style={{ maxWidth: '100%', minWidth: 0 }}>
                          {isTransparent ? (
                            <>
                              <span 
                                className="flex items-center gap-1 link-color font-medium cursor-pointer"
                                style={{ minWidth: 0, flex: '0 1 auto' }}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  if (user && onClick) {
                                    onClick()
                                  }
                                }}
                                title={userName}
                              >
                                <UserAvatar 
                                  user={user}
                                  userName={userName}
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
                                  {userName}
                                </span>
                              </span>
                              <span style={{ flexShrink: 0 }}>:</span>
                              <span 
                                className="overflow-hidden text-ellipsis"
                                style={{ 
                                  whiteSpace: 'nowrap', minWidth: 0, flex: '1 1 auto', textAlign: 'center'
                                }}
                              >
                                {interest}
                              </span>
                            </>
                          ) : (
                            <span 
                              className="overflow-hidden text-ellipsis"
                              style={{ 
                                whiteSpace: 'nowrap',
                                minWidth: 0,
                                maxWidth: '100%',
                                display: 'inline-block'
                              }}
                            >
                              {interest} ({opaqueCount})
                            </span>
                          )}
                        </div>
                      }
                      size="small"
                      key={chipKey}
                      style={{ maxWidth: '100%', height: 'unset' }}
                    />
                  )
                  
                  const handleUserClick = () => {
                    if (user) {
                      onUserClick(user)
                    }
                  }
                  
                  const chip = <CustomChip onClick={handleUserClick} />
                  
                  // Create custom tooltip content for transparent chips
                  const userInfo = isTransparent ? (user as User | undefined) : null
                  const tooltipContent = isTransparent && userInfo ? (
                    <div className="flex items-center gap-2 p-2">
                      <UserAvatar 
                        user={userInfo}
                        userName={userName}
                        size="lg"
                      />
                      <div className="flex flex-col">
                        <div className="font-medium text-lg">{userName}</div>
                        {userInfo.about && (
                          <div className="text-sm opacity-80 max-w-xs">{userInfo.about}</div>
                        )}
                      </div>
                    </div>
                  ) : chipTooltipText
                  
                  // For transparent chips, we need custom handling with two separate clickable areas
                  if (isTransparent) {
                    return (
                      <Chip
                        label={
                          <div className="flex items-center gap-1 p-1 flex-wrap" style={{ maxWidth: '100%', minWidth: 0 }}>
                            <Tooltip title={tooltipContent} placement="top">
                              <span 
                                className="flex items-center gap-1 link-color font-medium cursor-pointer"
                                style={{ minWidth: 0, flex: '0 1 auto' }}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  if (user && handleUserClick) {
                                    handleUserClick()
                                  }
                                }}
                              >
                                <UserAvatar 
                                  user={user}
                                  userName={userName}
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
                                  {userName}
                                </span>
                              </span>
                            </Tooltip>
                            <span style={{ flexShrink: 0 }}>:</span>
                            {joinableMeeting ? (
                              <Tooltip title={chipTooltipText} placement="top">
                                <Link 
                                  href={`/meeting?meetingToConnectId=${joinableMeeting._id}&timeslot=${slot.timestamp}&interest=${interest}`}
                                  className="overflow-hidden text-ellipsis link-color"
                                  style={{ 
                                    whiteSpace: 'nowrap', minWidth: 0, flex: '1 1 auto', textAlign: 'center'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {interest}
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
                                  {interest}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        }
                        size="small"
                        key={chipKey}
                        style={{ maxWidth: '100%', height: 'unset' }}
                      />
                    )
                  }
                  
                  // For non-transparent chips, use the original logic
                  return (
                    <Tooltip title={chipTooltipText} placement="top" key={chipKey + '-tooltip'}>
                      {joinableMeeting ? (
                        <Link className="max-w-full" href={`/meeting?meetingToConnectId=${joinableMeeting?._id}&timeslot=${slot.timestamp}&interest=${interest}`}>
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