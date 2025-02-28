import { Typography, Chip, Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import UserCard from './UserCard'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import LanguageIcon from '@mui/icons-material/Language'
import VideocamIcon from '@mui/icons-material/Videocam'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import IconButton from '@mui/material/IconButton'
import { format, addMinutes, differenceInMinutes, isWithinInterval, isSameDay, isToday, isPast, formatDistance } from 'date-fns'
import { LANGUAGES } from '@/config/languages'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'

interface MeetingProps {
  meetingWithPeer: {
    meeting: {
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

  // Check if this is a matched meeting that's currently active
  const isActiveNow = meeting.startTime && meeting.peerMeetingId && 
    meeting.startTime <= now.getTime() && 
    meeting.startTime + (meeting.minDuration * 60 * 1000) >= now.getTime()

  // Format the start time
  const formatStartTime = () => {
    if (!meeting.startTime) return null
    
    const startDate = new Date(meeting.startTime)
    
    if (isActiveNow) {
      return t('now')
    }
    
    if (isToday(startDate)) {
      return `${t('today')} ${format(startDate, 'HH:mm')}`
    }
    
    if (startDate > now) {
      return formatDistance(startDate, now, { addSuffix: true })
    }
    
    return format(startDate, 'MMM d, HH:mm')
  }

  const handleCallPeer = () => {
    if (meetingWithPeer.peerUser && meetingWithPeer.peerUser.userId) {
      //doCall(meetingWithPeer.peerUser)
    }
  }

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
      <div className="flex flex-wrap gap-2">
        {meeting.statuses.map(status => (
          <Chip
            key={status}
            label={tStatus(status)}
            size="small"
            className="text-xs text-white bg-gray-700"
          />
        ))}
      </div>
      {meeting.languages && meeting.languages.length > 0 && (
        <div className="flex items-center gap-2">
          <LanguageIcon className="text-gray-400" fontSize="small" />
          <div className="flex flex-wrap gap-1">
            {meeting.languages.map(langCode => {
              const language = LANGUAGES.find(l => l.code === langCode)
              return (
                <Chip
                  key={langCode}
                  label={language?.name || langCode}
                  size="small"
                  className="text-xs text-white bg-gray-700"
                />
              )
            })}
          </div>
        </div>
      )}
      
      {meeting.peerMeetingId && meeting.startTime && (
        <div className="flex flex-col gap-1 mt-1 p-2 bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between">
            <Typography variant="subtitle2" className="text-green-400">
              {t('matchedMeeting')}
            </Typography>
            <Chip
              label={formatStartTime()}
              size="small"
              className={`text-xs ${isActiveNow ? 'bg-green-700 text-white' : 'bg-gray-600 text-gray-200'}`}
            />
          </div>
          
          {meetingWithPeer.peerUser && (
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                <Typography variant="body2" className="text-gray-200">
                  {meetingWithPeer.peerUser.name}
                </Typography>
                {meetingWithPeer.peerUser.online && (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
              </div>
              
              {isActiveNow && meetingWithPeer.peerUser.online && (
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
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <AccessTimeIcon className="text-gray-400" fontSize="small" />
        <Typography variant="body2" className="text-gray-300">
          {meeting.minDuration} min
        </Typography>
        {meeting.preferEarlier && (
          <TrendingUpIcon className="text-gray-400" fontSize="small" titleAccess={t('preferEarlier')} />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Typography variant="body2" className="text-gray-300">
          {meeting.allowedMales && meeting.allowedFemales 
            ? t('anyGender') 
            : meeting.allowedMales 
              ? t('malesOnly') 
              : t('femalesOnly')}
        </Typography>
        <Typography variant="body2" className="text-gray-300">
          {t('ageRange')}: {meeting.allowedMinAge}-{meeting.allowedMaxAge}
        </Typography>
      </div>
      {!hasFutureSlots && (
        <Typography variant="body2" className="text-gray-400 italic">
          {t('allSlotsInPast')}
        </Typography>
      )}
      <div className="space-y-2">
        {Object.entries(timeSlotsByDay).map(([day, slots]) => {
          const combinedSlots = combineAdjacentSlots(slots)
          
          if (combinedSlots.length === 0) return null;
          
          return (
            <div key={day} className="flex items-center gap-2">
              <Typography variant="body2" className="text-gray-400 font-medium">
                {day}
              </Typography>
              <div className="flex flex-wrap gap-1 ml-2">
                {combinedSlots.map(([startSlot, endSlot], index) => {
                  const isActive = isWithinInterval(now, {
                    start: new Date(startSlot),
                    end: new Date(endSlot)
                  })
                  
                  return (
                    <Chip
                      key={`${startSlot}-${endSlot}`}
                      label={formatTimeSlot(startSlot, endSlot)}
                      size="small"
                      className="text-xs"
                      sx={{
                        backgroundColor: isActive ? '#B45309' : '#374151',
                        color: 'white',
                        border: isActive ? '2px solid #FBBF24' : 'none',
                        '&.MuiChip-root': {
                          backgroundColor: isActive ? '#B45309 !important' : '#374151 !important',
                        }
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="h-6"></div>
    </div>
  )
} 