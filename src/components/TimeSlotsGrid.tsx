import { Button, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'
import { getDayLabel } from '@/utils/meetingUtils'

interface TimeSlot {
  timestamp: number
  startTime: string
  endTime: string
  day: string
  isPartial?: boolean
  remainingMinutes?: number
  isDummy?: boolean
  isDisabled?: boolean
}

interface TimeSlotsGridProps {
  timeSlots: TimeSlot[]
  selectedTimeSlots: number[]
  onToggleTimeSlot: (timestamp: number) => void
}

export default function TimeSlotsGrid({ 
  timeSlots, 
  selectedTimeSlots, 
  onToggleTimeSlot
}: TimeSlotsGridProps) {
  const t = useTranslations()
  
  // Group time slots by day
  const timeSlotsByDay = timeSlots.reduce((acc, slot) => {
    const day = slot.day
    if (!acc[day]) acc[day] = []
    acc[day].push(slot)
    return acc
  }, {} as Record<string, TimeSlot[]>)

  return (
    <div className="space-y-2">
      {Object.entries(timeSlotsByDay).map(([day, slots]) => (
        <div key={day} className="mb-2">
          <div className="mb-2">
            <Typography variant="subtitle2">
              {getDayLabel(new Date(slots[0].timestamp), t)}
            </Typography>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {slots.map(slot => (
              slot.isDummy ? (
                <div key={`dummy-${slot.startTime}`} className="h-9"></div>
              ) : (
                <Button
                  key={slot.timestamp}
                  data-timeslot={slot.timestamp}
                  variant={selectedTimeSlots.includes(slot.timestamp) ? "contained" : "outlined"}
                  size="small"
                  onClick={() => onToggleTimeSlot(slot.timestamp)}
                  disabled={slot.isDisabled}
                  className={`text-xs ${slot.isPartial ? 'border-yellow-500' : ''} ${
                    slot.isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {slot.isPartial ? t('now') : slot.startTime} - {slot.endTime}
                </Button>
              )
            ))}
          </div>
        </div>
      ))}
      {timeSlots.length === 0 && (
        <Typography className="text-gray-400 text-center py-4">
          {t('noTimeSlotsAvailable')}
        </Typography>
      )}
    </div>
  )
} 