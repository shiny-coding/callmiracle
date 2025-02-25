import { Button, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'

interface TimeSlot {
  timestamp: number
  startTime: string
  endTime: string
  day: string
  isPartial?: boolean
  remainingMinutes?: number
  isDummy?: boolean
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
    <div className="space-y-4">
      {Object.entries(timeSlotsByDay).map(([day, slots]) => (
        <div key={day} className="mb-4">
          <Typography variant="subtitle2" className="mb-2">{day}</Typography>
          <div className="grid grid-cols-4 gap-2">
            {slots.map(slot => (
              slot.isDummy ? (
                <div key={`dummy-${slot.startTime}`} className="h-9"></div>
              ) : (
                <Button
                  key={slot.timestamp}
                  variant={selectedTimeSlots.includes(slot.timestamp) ? "contained" : "outlined"}
                  size="small"
                  onClick={() => onToggleTimeSlot(slot.timestamp)}
                  className={`text-xs ${slot.isPartial ? 'border-yellow-500' : ''}`}
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