import { Typography, Chip, Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import UserCard from './UserCard'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
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
import React from 'react'

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
      userId: string
      name: string
      hasImage: boolean
      online: boolean
    }
  }
  onEdit?: (e?: React.MouseEvent) => void
  onDelete?: (e?: React.MouseEvent) => void
}

export default function MeetingCard({ meetingWithPeer, onEdit, onDelete }: MeetingProps) {
  const t = useTranslations()
  const tStatus = useTranslations('Status')
  const now = new Date()
  const { doCall } = useWebRTCContext()
  const meeting = meetingWithPeer.meeting

  // Get intersection of statuses for matched meetings
  const sharedStatuses = meeting.peerMeetingId && meetingWithPeer.peerMeeting 
    ? meeting.statuses.filter(status => 
        meetingWithPeer.peerMeeting?.statuses.includes(status)
      )
    : []

  // Check if all time slots have passed
  const allSlotsPassed = meeting.timeSlots.every(slot => {
    const endTime = new Date(slot + 30 * 60 * 1000); // 30 minutes after start
    return endTime < now;
  });

  // Check if meeting has passed (either all slots passed or meeting ended)
  const isMeetingPassed = allSlotsPassed || (meeting.startTime && 
    (new Date(meeting.startTime + meeting.minDuration * 60 * 1000) < now));
    
  // Text color class based on meeting status
  const textColorClass = isMeetingPassed ? "text-gray-400" : "text-gray-300";

  // Determine icon color based on meeting status
  const getIconColor = () => {
    if (allSlotsPassed) return "text-gray-400";
    if (meeting.peerMeetingId) {
      // Check if meeting is active now
      if (meeting.startTime) {
        const meetingEndTime = new Date(meeting.startTime + meeting.minDuration * 60 * 1000);
        if (now < meetingEndTime) return "text-green-400";
      }
    }
    return "text-blue-400"; // Finding partner
  };

  const iconColorClass = getIconColor();

  // Reusable chip styling for passed vs active meetings
  const getChipSx = (isActive = false) => ({
    backgroundColor: isActive 
      ? '#22C55E !important' 
      : isMeetingPassed 
        ? 'transparent !important' 
        : '#4B5563 !important',
    color: isMeetingPassed 
      ? '#9ca3af !important' 
      : 'white !important',
    border: isActive 
      ? '2px solid #4ADE80 !important' 
      : isMeetingPassed 
        ? '2px solid #9ca3af !important' 
        : '2px solid #3B82F6 !important',
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
  
  // Check if there are any future time slots
  const hasFutureSlots = meeting.timeSlots.some(slot => {
    const endTime = new Date(slot + 30 * 60 * 1000) // 30 minutes in milliseconds
    return endTime > now
  })

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
    if (meetingWithPeer.peerUser && meetingWithPeer.peerUser.userId) {
      doCall(meetingWithPeer.peerUser as User, meetingWithPeer.meeting._id)
    }
  }

  const statusesToShow = meeting.peerMeetingId ? meetingWithPeer.peerMeeting?.statuses : meeting.statuses
  const languagesToShow = meeting.peerMeetingId ? meetingWithPeer.peerMeeting?.languages : meeting.languages

  return (
    <div className="flex flex-col gap-2 w-full relative">
      {onEdit && (
        <div className="absolute top-0 right-0">
          <IconButton 
            className="text-blue-400 hover:bg-gray-600 p-1"
            onClick={(e) => {
            e.stopPropagation();
            onEdit(e);
          }}
          size="small"
        >
            <EditIcon fontSize="small" />
          </IconButton>
        </div>
      )}
      {onDelete && (
        <div className="absolute bottom-0 right-0">
          <IconButton 
            className="text-red-400 hover:bg-gray-600 p-1"
            onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
          size="small"
        >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </div>
      )}

      <div className="flex items-center justify-center">
        <Typography variant="subtitle2" 
          className={`
            ${!isMeetingPassed ? 'text-blue-400' : 'text-gray-400'} 
            ${isMeetingPassed ? 'opacity-70' : 'opacity-100'}
          `}
        >
          {isMeetingPassed 
              ? t('meetingPassed')
            : meeting.peerMeetingId 
              ? t('partnerFound')
              : t('findingPartner')
          }
        </Typography>
      </div>

      {meeting.peerMeetingId && meeting.startTime && (
        <div className="flex flex-col gap-1">
          
          {meetingWithPeer.peerUser && (
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                <CallIcon fontSize="small" className={iconColorClass} />
                <Typography variant="body2" className={isMeetingPassed ? "text-gray-400" : "text-gray-200"}>
                  {meeting.lastCallTime 
                    ? meetingWithPeer.peerUser.name 
                    : t('anonymousPartner')}
                </Typography>
                {meetingWithPeer.peerUser.online && (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
              </div>
              
              {meetingStatus.status === 'now' && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<VideocamIcon />}
                  onClick={handleCallPeer}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {t('call')}
                </Button>
              )}
            </div>
          )}

          {/* Show shared statuses if there are any */}
          
        </div>
      )}
      <div className="flex items-center gap-2">
        <AccessTimeIcon className={iconColorClass} fontSize="small" />
        <div className="flex flex-wrap items-center gap-2">
          {meeting.startTime ? (
            <Chip
              label={meetingStatus.timeText || formatDateForDisplay(new Date(meeting.startTime))}
              size="small"
              className={`text-xs`}
              sx={getChipSx(isActiveNow)}
            />
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 w-full">
              {Object.entries(timeSlotsByDay).map(([day, slots]) => {
                const combinedSlots = combineAdjacentSlots(slots)
                
                if (combinedSlots.length === 0) return null;
                
                return (
                  <React.Fragment key={day}>
                    <Typography variant="body2" className={`${textColorClass} whitespace-nowrap`}>
                      {day}
                    </Typography>
                    <div className="flex flex-wrap gap-1">
                      {combinedSlots.map(([startSlot, endSlot], index) => {
                        const isActive = isWithinInterval(now, {
                          start: new Date(startSlot),
                          end: new Date(endSlot)
                        }) && meeting.peerMeetingId
                        
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
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          )}
          {!isMeetingPassed && (
            <Typography variant="body2" className={textColorClass}>
              {meeting.minDuration} {t('min')}
            </Typography>
          )}
          {isMeetingPassed && meeting.totalDuration && meeting.totalDuration > 0 && (
            <Chip
              label={`${t('callDuration')}: ${formatDuration(meeting.totalDuration)}`}
              size="small"
              className={`text-xs text-white bg-gray-500`}
            />
          )}
          {isMeetingPassed && (
            <Typography variant="body2" className={`${textColorClass} pl-2`}>
              {getFirstSlotDay()}
            </Typography>
          )}
        </div>
        {meeting.preferEarlier && (
          <TrendingUpIcon className={iconColorClass} fontSize="small" titleAccess={t('preferEarlier')} />
        )}
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

    </div>
  )
} 