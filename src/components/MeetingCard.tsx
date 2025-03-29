import { Typography, Chip, Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import UserCard from './UserCard'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TimerIcon from '@mui/icons-material/Timer'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import LanguageIcon from '@mui/icons-material/Language'
import VideocamIcon from '@mui/icons-material/Videocam'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import MoodIcon from '@mui/icons-material/Mood'
import CallIcon from '@mui/icons-material/Call'
import IconButton from '@mui/material/IconButton'
import { format, addMinutes, differenceInMinutes, isWithinInterval, isSameDay, isToday, isPast, formatDistance, differenceInHours, differenceInSeconds } from 'date-fns'
import { LANGUAGES } from '@/config/languages'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { User } from '@/generated/graphql'
import { formatDuration } from '@/utils/formatDuration'
import { isMeetingPassed, getSharedStatuses, getSharedLanguages } from '@/utils/meetingUtils'
import React from 'react'
import { useStore } from '@/store/useStore'
import DoneIcon from '@mui/icons-material/Done'
import CancelIcon from '@mui/icons-material/Cancel'
import { gql, useMutation } from '@apollo/client'
import { MeetingStatus } from '@/generated/graphql'

const UPDATE_MEETING_LAST_CALL = gql`
  mutation UpdateMeetingStatus($input: UpdateMeetingStatusInput!) {
    updateMeetingStatus(input: $input) {
      _id
      status
    }
  }
`

interface MeetingProps {
  meetingWithPeer: {
    meeting: {
      _id: string
      userId: string
      languages: string[]
      statuses: string[]
      timeSlots: number[]
      minDuration: number
      preferEarlier: boolean
      allowedMales: boolean
      allowedFemales: boolean
      allowedMinAge: number
      allowedMaxAge: number
      startTime?: number
      peerMeetingId?: string
      lastCallTime?: number
      status: string
      totalDuration: number
    }
    peerMeeting?: {
      userId: string
      languages: string[]
      statuses: string[]
    }
    peerUser?: {
      _id: string
      name: string
      hasImage: boolean
      online: boolean
      sex: string
      languages: string[]
    }
  }
  onEdit?: (e?: React.MouseEvent) => void
  onDelete?: (e?: React.MouseEvent) => void
  refetch: () => void
}

export default function MeetingCard({ meetingWithPeer, onEdit, onDelete, refetch }: MeetingProps) {
  const t = useTranslations()
  const tStatus = useTranslations('Status')
  const now = new Date()
  const { doCall } = useWebRTCContext()
  const { currentUser } = useStore()
  const meeting = meetingWithPeer.meeting
  const [updateMeetingStatus] = useMutation(UPDATE_MEETING_LAST_CALL)

  // Check if meeting has passed using the utility function
  const meetingPassed = isMeetingPassed(meeting);
    
  // Text color class based on meeting status
  const textColorClass = meetingPassed ? "text-gray-400" : "text-gray-300";

  // Determine meeting color based on its state
  const getMeetingColor = () => {
    if (meetingPassed) return "#9ca3af"; // gray-400
    
    if (meeting.peerMeetingId) {
      // Meeting has a partner
      if (meeting.startTime) {
        const meetingEndTime = new Date(meeting.startTime + meeting.minDuration * 60 * 1000);
        
        // Meeting is currently active
        if (now < meetingEndTime && now >= new Date(meeting.startTime)) {
          return "#4ADE80"; // green-600
        }
        
        // Meeting is scheduled but not yet started
        if (now < new Date(meeting.startTime)) {
          return "#FBBF24"; // yellow-400
        }
      }
      
      // Partner found but not scheduled yet
      return "#FBBF24"; // yellow-400
    }
    
    // Finding partner
    return "#3B82F6"; // blue-500
  };
  
  const meetingColor = getMeetingColor();
  const iconColor = meetingPassed ? "text-gray-400" : 
                    meetingColor === "#4ADE80" ? "text-green-400" :
                    meetingColor === "#FBBF24" ? "text-yellow-400" : 
                    "text-blue-500";

  const iconColorClass = iconColor;

  // Reusable chip styling for passed vs active meetings
  const getChipSx = (isActive = isActiveNow) => ({
    backgroundColor: isActive 
      ? 'transparent !important' 
      : meetingPassed 
        ? 'transparent !important' 
        : '#4B5563 !important',
    color: meetingPassed 
      ? '#9ca3af !important' 
      : 'white !important',
    border: isActive 
      ? '2px solid #4ADE80 !important' 
      : meetingPassed 
        ? '2px solid #9ca3af !important' 
        : `2px solid ${meetingColor} !important`,
  });

  const formatTimeSlot = (startTimestamp: number, endTimestamp: number) => {
    const startDate = new Date(startTimestamp)
    const endDate = new Date(endTimestamp)
    
    // Check if this is a partial slot (close to current time)
    const isCurrentSlot = isWithinInterval(now, {
      start: startDate,
      end: endDate
    })
    
    // Format the start time - show "NOW" if it's the current slot
    const startTime = isCurrentSlot ? t('now') : format(startDate, 'HH:mm')
    
    return `${startTime}-${format(endDate, 'HH:mm')}`
  }

  // Format date for display, showing "Today" if it's today
  const formatDateForDisplay = (date: Date) => {
    if (isToday(date)) {
      return `${t('today')} ${format(date, 'HH:mm')}`
    }
    return format(date, 'MMM d, HH:mm')
  }

  // Get the day of the first time slot for passed meetings without a peer
  const getFirstSlotDay = () => {
    if (meeting.timeSlots.length === 0) return '';
    
    // Sort time slots chronologically
    const sortedSlots = [...meeting.timeSlots].sort((a, b) => a - b);
    const firstSlotDate = new Date(sortedSlots[0]);
    
    // Format the date to show the day
    if (isToday(firstSlotDate)) {
      return t('today');
    }
    return format(firstSlotDate, 'MMM d');
  }

  // Group time slots by day
  const groupTimeSlotsByDay = () => {
    const groups: Record<string, number[]> = {}
    
    // Sort time slots chronologically
    const sortedSlots = [...meeting.timeSlots].sort((a, b) => a - b)
    
    sortedSlots.forEach(timestamp => {
      const date = new Date(timestamp)
      
      // Skip slots that are in the past (end time is before now)
      const endTime = new Date(timestamp + 30 * 60 * 1000) // 30 minutes after start
      if (endTime < now) return
      
      // Use "Today" for today's date
      const dayKey = isToday(date) ? t('today') : format(date, 'EEE dd MMM')
      
      if (!groups[dayKey]) {
        groups[dayKey] = []
      }
      
      groups[dayKey].push(timestamp)
    })
    
    return groups
  }

  // Combine adjacent time slots
  const combineAdjacentSlots = (slots: number[]): [number, number][] => {
    if (slots.length === 0) return []
    
    // Sort slots chronologically
    const sortedSlots = [...slots].sort((a, b) => a - b)
    
    const combinedSlots: [number, number][] = []
    let currentStart = sortedSlots[0]
    let currentEnd = currentStart + 30 * 60 * 1000 // 30 minutes in milliseconds
    
    for (let i = 1; i < sortedSlots.length; i++) {
      const slotTime = sortedSlots[i]
      
      // If this slot starts exactly when the previous ends, combine them
      if (slotTime === currentEnd) {
        // Extend the current slot
        currentEnd = slotTime + 30 * 60 * 1000
      } else {
        // This slot is not adjacent, so save the current combined slot and start a new one
        combinedSlots.push([currentStart, currentEnd])
        currentStart = slotTime
        currentEnd = slotTime + 30 * 60 * 1000
      }
    }
    
    // Add the last slot or combined slot
    combinedSlots.push([currentStart, currentEnd])
    
    return combinedSlots
  }

  const timeSlotsByDay = groupTimeSlotsByDay()
  
  // Check meeting status more precisely
  const getMeetingStatus = () => {
    if (!meeting.startTime) return { status: 'not-scheduled', timeText: '' };
    
    const startDate = new Date(meeting.startTime);
    const endDate = new Date(meeting.startTime + meeting.minDuration * 60 * 1000);
    const threeHoursAfterStart = new Date(meeting.startTime + 3 * 60 * 60 * 1000);
    
    // Meeting is happening now
    if (now >= startDate && now <= endDate) {
      return { status: 'now', timeText: t('now') };
    }
    
    // Meeting is in the past but still within 3 hours window
    if (now > endDate && now <= threeHoursAfterStart) {
      return { status: 'recent', timeText: t('recentlyEnded') };
    }
    
    // Meeting is in the future
    if (now < startDate) {
      const diffSeconds = differenceInSeconds(startDate, now);
      const diffHours = differenceInHours(startDate, now);
      
      if (diffHours < 8) {
        if (diffHours < 1) {
          // Less than 1 hour
          const mins = Math.floor(diffSeconds / 60);
          return { 
            status: 'soon', 
            timeText: t('startsInMinutes', { minutes: mins }) 
          };
        } else if (diffHours < 3) {
          // Less than 3 hours
          const hours = Math.floor(diffHours);
          const mins = Math.floor((diffSeconds % (60 * 60)) / 60);
          return { 
            status: 'upcoming', 
            timeText: t('startsInHoursMinutes', { hours, minutes: mins }) 
          };
        } else {
          // Between 3 and 8 hours
          const hours = Math.floor(diffHours);
          return {
            status: 'today',
            timeText: t('startsInHours', { hours })
          };
        }
      }
    }
    
    // Default: just show the date
    return { 
      status: 'scheduled', 
      timeText: formatDateForDisplay(startDate) 
    };
  };
  
  const meetingStatus = getMeetingStatus();
  const isActiveNow = meetingStatus.status === 'now';

  const handleCallPeer = () => {
    if (meetingWithPeer.peerUser && meetingWithPeer.peerUser._id) {
      console.log('calling peer', meetingWithPeer.peerUser, meetingWithPeer.meeting._id)
      // If this is a first call (no lastCallTime), don't show user info
      doCall(meetingWithPeer.peerUser as User, false, meetingWithPeer.meeting._id, meetingWithPeer.meeting.lastCallTime ?? null)
    }
  }

  const statusesToShow = getSharedStatuses(meeting, meetingWithPeer.peerMeeting)
  const languagesToShow = getSharedLanguages(meeting, meetingWithPeer.peerMeeting)

  const getPartnerIcon = () => {
    if (meeting.peerMeetingId) {
      if (currentUser?.sex === meetingWithPeer.peerUser?.sex) {
        return currentUser?.sex === 'male' ? '👬' : '👭'
      } else {
        return '👫'
      }
    }
    return null
  }

  const handleFinishMeeting = async () => {
    try {
      await updateMeetingStatus({
        variables: {
          input: {
            _id: meeting._id,
            status: MeetingStatus.Finished
          }
        }
      })
      refetch()
    } catch (error) {
      console.error('Error finishing meeting:', error)
    }
  }
  
  const handleCancelMeeting = async () => {
    try {
      await updateMeetingStatus({
        variables: {
          input: {
            _id: meeting._id,
            status: MeetingStatus.Cancelled
          }
        }
      })
      refetch()
    } catch (error) {
      console.error('Error canceling meeting:', error)
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full relative">
      <div className="absolute top-0 right-0">
        {meeting.status !== MeetingStatus.Called && meeting.status !== MeetingStatus.Finished && !meetingPassed && (
          <IconButton 
            className="text-blue-400 hover:bg-gray-600 p-1"
            onClick={(e) => {
            e.stopPropagation();
            onEdit?.(e);
          }}
          size="small"
        >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </div>
        <div className="absolute bottom-0 right-0">
        {!meetingPassed && meeting.status === MeetingStatus.Called ? (
          <Button
            variant="contained"
            color="warning"
            startIcon={<DoneIcon />}
            onClick={handleFinishMeeting}
            size="small"
          >
            {t('finishMeeting')}
          </Button>
        ) : meetingStatus.status === 'now' || (meeting.startTime && meeting.startTime > now.getTime()) ? (
          <Button
            variant="contained"
            color="warning"
            startIcon={<CancelIcon />}
            onClick={handleCancelMeeting}
            size="small"
          >
            {t('cancelMeeting')}
          </Button>
        ) : (
          <IconButton 
            className="text-red-400 hover:bg-gray-600 p-1"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(e);
            }}
            size="small"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </div>
      {/* <div className="absolute top-4 left-0">{meeting._id}</div> */}

      <div className="flex items-center justify-center">
        <Typography variant="subtitle2" 
          className="font-bold"
          sx={{ color: meetingColor, fontWeight: 'bold' }}
        >
          {meetingPassed 
              ? t('meetingPassed')
            : meeting.peerMeetingId 
              ? ( t('partnerFound') + ' ' + getPartnerIcon() )
              : t('findingPartner')
          }
        </Typography>
      </div>

      {meeting.peerMeetingId && meeting.startTime && (
        <div className="flex flex-col gap-1">
          
          {meetingWithPeer.peerUser && (
            <div className="flex items-center justify-center gap-2 mt-2">

            {meeting.lastCallTime && (
              <div className="flex items-center gap-1">
                <Typography variant="body2" className={meetingPassed ? "text-gray-400" : "text-gray-200"}>
                  {meetingWithPeer.peerUser.name}
                </Typography>
                {meetingWithPeer.peerUser.online && (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
              </div>
            )}              
              {meetingStatus.status === 'now' && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<VideocamIcon />}
                  onClick={handleCallPeer}
                  className="text-white"
                  sx={{
                    backgroundColor: '#4ADE80 !important', // light green
                    '&:hover': {
                      backgroundColor: '#22C55E !important', // slightly darker green on hover
                    }
                  }}
                >
                  {t('call')}
                </Button>
              )}
            </div>
          )}
          
        </div>
      )}
      <div className="flex items-center gap-2">
        <AccessTimeIcon className={iconColorClass} fontSize="small" />
        <div className="flex flex-wrap items-center gap-2 w-full">
          {meeting.startTime ? (
            <Chip
              label={meetingStatus.timeText || formatDateForDisplay(new Date(meeting.startTime))}
              size="small"
              className={`text-xs`}
              sx={getChipSx()}
            />
          ) : (
            !meetingPassed ? (
              <>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 w-full">
                  {Object.entries(timeSlotsByDay).map(([day, slots], index) => {
                    const combinedSlots = combineAdjacentSlots(slots)
                    
                    if (combinedSlots.length === 0) return null;
                    const isLastEntry = index === Object.entries(timeSlotsByDay).length - 1
                    return (
                      <React.Fragment key={day}>
                        <Typography variant="body2" className={`${textColorClass} whitespace-nowrap flex items-center h-6`}>
                          {day}
                        </Typography>
                        <div className="grid grid-cols-[repeat(auto-fill,90px)] gap-1">
                          {combinedSlots.map(([startSlot, endSlot], index) => {
                            const isActive = isWithinInterval(now, {
                              start: new Date(startSlot),
                              end: new Date(endSlot)
                            }) && !!meeting.peerMeetingId
                            
                            return (
                              <Chip
                                key={`${startSlot}-${endSlot}`}
                                label={formatTimeSlot(startSlot, endSlot)}
                                size="small"
                                className="text-xs"
                                sx={getChipSx(isActive)}
                              />
                            )
                          })}
                          {isLastEntry && (
                            <Typography 
                              variant="body2"
                              className={`${textColorClass} flex items-center pl-1`}
                          >
                            {meeting.minDuration} {t('min')}
                          </Typography>
                          )}
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>
              </>
            ) : null
          )}
          {meetingPassed && meeting.totalDuration && meeting.totalDuration > 0 && (
            <Chip
              label={`${t('callDuration')}: ${formatDuration(meeting.totalDuration)}`}
              size="small"
              className={`text-xs text-white bg-gray-500`}
            />
          )}
          {meetingPassed && !meeting.peerMeetingId && (
            <Chip
              label={getFirstSlotDay()}
              size="small"
              className={`text-xs text-white bg-gray-500`}
              sx={getChipSx(false)}
            />
          )}
        </div>        
    </div>
      <div className="flex items-center gap-2">
        <MoodIcon className={iconColorClass} fontSize="small" />
        <div className="flex flex-wrap gap-2">
        {statusesToShow && statusesToShow.map(status => (
          <Chip
            key={status}
            label={tStatus(status)}
            size="small"
            className="text-xs"
            sx={getChipSx()}
          />
        ))}
        </div>
      </div>
      {languagesToShow && languagesToShow.length > 0 && (
        <div className="flex items-center gap-2">
          <LanguageIcon className={iconColorClass} fontSize="small" />
          <div className="flex flex-wrap gap-1">
            {languagesToShow.map(langCode => {
              const language = LANGUAGES.find(l => l.code === langCode)
              return (
                <Chip
                  key={langCode}
                  label={language?.name || langCode}
                  size="small"
                  className="text-xs"
                  sx={getChipSx()}
                />
              )
            })}
          </div>
        </div>
      )}
          

      {!meeting.peerMeetingId && (
        <div className="flex items-center gap-2">
          <Typography variant="body2" className={textColorClass}>
            {meeting.allowedMales && meeting.allowedFemales 
              ? t('anyGender') 
              : meeting.allowedMales 
                ? t('malesOnly') 
                : t('femalesOnly')}
          </Typography>
          <Typography variant="body2" className={textColorClass}>
            {t('ageRange')}: {meeting.allowedMinAge}-{meeting.allowedMaxAge}
          </Typography>
        </div>
      )}

      {meeting.totalDuration > 0 && (
        <div className="flex items-center gap-2">
          <TimerIcon className="text-blue-400" />
          <Typography variant="body2">
            {t('totalDuration')}: {formatDuration(meeting.totalDuration)}
          </Typography>
        </div>
      )}

    </div>
  )
} 