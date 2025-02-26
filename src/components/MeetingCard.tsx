import { Typography, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import UserCard from './UserCard'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import LanguageIcon from '@mui/icons-material/Language'
import { format, addMinutes, differenceInMinutes, isWithinInterval, isSameDay, isToday, isPast } from 'date-fns'
import { LANGUAGES } from '@/config/languages'

interface MeetingProps {
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
    user: {
      userId: string
      name: string
      hasImage: boolean
      online: boolean
    }
  }
}

export default function MeetingCard({ meeting }: MeetingProps) {
  const t = useTranslations()
  const tStatus = useTranslations('Status')
  const now = new Date()

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
  const hasFutureSlots = Object.values(timeSlotsByDay).some(slots => slots.length > 0)

  return (
    <div className="space-y-2">
      {/* <UserCard 
        user={meeting.user}
        showDetails={false}
        showCallButton={true}
      /> */}
      <div className="flex flex-wrap gap-2 mt-2">
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
    </div>
  )
} 