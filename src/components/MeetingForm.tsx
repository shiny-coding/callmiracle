import { IconButton, Button, FormGroup, FormControlLabel, Checkbox, Slider, Typography, Divider } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslations } from 'next-intl'
import { useUpdateMeeting } from '@/hooks/useUpdateMeeting'
import { useStore } from '@/store/useStore'
import { useState, useEffect, ChangeEvent, useRef } from 'react'
import { Interest, Meeting } from '@/generated/graphql'
import InterestSelector from './InterestSelector'
import { format, addMinutes, isAfter, parseISO, setMinutes, setSeconds, setMilliseconds, differenceInMinutes, startOfHour, getMinutes } from 'date-fns'
import TimeSlotsGrid from './TimeSlotsGrid'
import LanguageSelector from './LanguageSelector'
import { isMeetingPassed } from '@/utils/meetingUtils'
import CircularProgress from '@mui/material/CircularProgress'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getDayLabel } from './MeetingsCalendar'
import { useMeetings } from '@/contexts/MeetingsContext'
import { getOccupiedTimeSlots } from '@/utils/meetingUtils'

function isSlotSelectable(slot: any) {
  return slot && !slot.isDummy && !slot.isDisabled
}

export default function MeetingForm() {
  const t = useTranslations()

  const { meetingsWithPeers, loadingMeetingsWithPeers, errorMeetingsWithPeers } = useMeetings()
  const { id: meetingId } = useParams()
  const meeting = meetingsWithPeers.find(m => m.meeting._id === meetingId)?.meeting

  const { currentUser } = useStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const timeslotParam = searchParams?.get('timeslot')
  const { 
    interests = [], 
    allowedMales = true, 
    allowedFemales = true, 
    allowedMinAge = 10, 
    allowedMaxAge = 100 
  } =  {}
  const [tempInterests, setTempInterests] = useState<Interest[]>(interests)
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<number[]>([])
  const [availableTimeSlots, setAvailableTimeSlots] = useState<{timestamp: number, startTime: string, endTime: string, day: string, isPartial?: boolean, remainingMinutes?: number, isDummy?: boolean, isDisabled?: boolean}[]>([])
  const [minDuration, setMinDuration] = useState(60)
  const [preferEarlier, setPreferEarlier] = useState(true)
  const [tempAllowedMales, setTempAllowedMales] = useState(allowedMales)
  const [tempAllowedFemales, setTempAllowedFemales] = useState(allowedFemales)
  const [tempAgeRange, setTempAgeRange] = useState<[number, number]>([allowedMinAge, allowedMaxAge])
  const [tempLanguages, setTempLanguages] = useState<string[]>([])
  const { updateMeeting, loading } = useUpdateMeeting()
  const [occupiedTimeSlots, setOccupiedTimeSlots] = useState<number[]>([])
  const [hasValidDuration, setHasValidDuration] = useState(true)
  const { refetchFutureMeetings } = useMeetings()
  const formContentRef = useRef<HTMLDivElement>(null)

  // Reset form when dialog opens or meeting changes
  useEffect(() => {
    if (meeting) {
      setTempInterests(meeting.interests || [])
      setSelectedTimeSlots(meeting.timeSlots || [])
      setMinDuration(meeting.minDuration || 60)
      setPreferEarlier(meeting.preferEarlier)
      setTempAllowedMales(meeting.allowedMales !== undefined ? meeting.allowedMales : true)
      setTempAllowedFemales(meeting.allowedFemales !== undefined ? meeting.allowedFemales : true)
      setTempAgeRange([
        meeting.allowedMinAge !== undefined ? meeting.allowedMinAge : 10,
        meeting.allowedMaxAge !== undefined ? meeting.allowedMaxAge : 100
      ])
      setTempLanguages(meeting.languages || (currentUser?.languages || []))
    } else {
      // Creating a new meeting
      setTempInterests([])
      setSelectedTimeSlots([]) // Explicitly clear selected time slots for new meetings
      setMinDuration(60)
      setPreferEarlier(true)
      setTempAllowedMales(true)
      setTempAllowedFemales(true)
      setTempAgeRange([10, 100])
      setTempLanguages(currentUser?.languages || [])
    }
    
    // Collect all time slots from other meetings that haven't passed
    if (meeting || meetingsWithPeers.length > 0) {
      setOccupiedTimeSlots(getOccupiedTimeSlots(meetingsWithPeers.map(m => m.meeting), meeting?._id))
    }
  }, [meeting, currentUser?.languages, meetingsWithPeers])

  // Generate available time slots
  useEffect(() => {
    const now = new Date()
    
    // Find the next half-hour boundary
    const minutes = now.getMinutes()
    const nextHalfHour = minutes < 30 ? 30 : 0
    const nextHalfHourTime = setMilliseconds(setSeconds(setMinutes(new Date(now), nextHalfHour), 0), 0)
    if (nextHalfHour === 0) {
      nextHalfHourTime.setHours(nextHalfHourTime.getHours() + 1)
    }
    
    // Calculate minutes until next half-hour
    const minutesUntilNextSlot = differenceInMinutes(nextHalfHourTime, now)
    
    const slots = []
    
    // Add the current partial slot but align it to the previous half-hour boundary
    if (minutesUntilNextSlot > 0) {
      // Find the previous half-hour boundary
      const prevHalfHourTime = new Date(now)
      if (minutes < 30) {
        // If we're before :30, go back to the hour
        prevHalfHourTime.setMinutes(0, 0, 0)
      } else {
        // If we're after :30, go back to the half hour
        prevHalfHourTime.setMinutes(30, 0, 0)
      }
      
      slots.push({
        timestamp: prevHalfHourTime.getTime(),
        startTime: format(prevHalfHourTime, 'HH:mm'),
        endTime: format(nextHalfHourTime, 'HH:mm'),
        day: format(now, 'EEE'),
        isPartial: true,
        remainingMinutes: minutesUntilNextSlot,
        isDisabled: occupiedTimeSlots.includes(prevHalfHourTime.getTime())
      })
    }
    
    // Generate slots for the next 7 days in 30-minute increments
    for (let i = 0; i < 7 * 24 * 2; i++) {
      const slotTime = addMinutes(nextHalfHourTime, i * 30)
      const endTime = addMinutes(slotTime, 30)
      
      // Skip slots that are in the past
      if (slotTime.getTime() < now.getTime()) continue;
      
      const slot = {
        timestamp: slotTime.getTime(),
        startTime: format(slotTime, 'HH:mm'),
        endTime: format(endTime, 'HH:mm'),
        day: format(slotTime, 'EEE'),
        isPartial: false,
        remainingMinutes: undefined,
        isDisabled: occupiedTimeSlots.includes(slotTime.getTime())
      }
      
      slots.push(slot)
    }
    
    // Sort slots by timestamp to ensure they appear in chronological order
    slots.sort((a, b) => a.timestamp - b.timestamp)
    
    // Group slots by day
    const slotsByDay = slots.reduce((acc, slot) => {
      const day = slot.day
      if (!acc[day]) acc[day] = []
      acc[day].push(slot)
      return acc
    }, {} as Record<string, typeof slots>)
    
    // For each day, ensure each hour starts with a slot
    const processedSlots = []
    
    for (const day in slotsByDay) {
      const daySlots = slotsByDay[day]
      
      // Process each slot
      for (let i = 0; i < daySlots.length; i++) {
        const slot = daySlots[i]
        const slotMinutes = getMinutes(new Date(slot.timestamp))
        
        // If this is the first slot of the day or the previous slot was at a different hour
        if (i === 0 || Math.floor(daySlots[i-1].timestamp / 3600000) !== Math.floor(slot.timestamp / 3600000)) {
          // If the slot doesn't start at :00, add a dummy slot
          if (slotMinutes === 30) {
            const hourStart = startOfHour(new Date(slot.timestamp))
            processedSlots.push({
              timestamp: hourStart.getTime() - 1, // Use timestamp-1 for dummy slots
              startTime: format(hourStart, 'HH:mm'),
              endTime: slot.startTime,
              day: slot.day,
              isDummy: true
            })
          }
        }
        
        processedSlots.push(slot)
      }
    }
    
    setAvailableTimeSlots(processedSlots)
  }, [open, occupiedTimeSlots])

  // Add new useEffect to validate time slot durations
  useEffect(() => {
    if (selectedTimeSlots.length === 0) {
      setHasValidDuration(true)
      return
    }

    // Check if selected time slots can form a continuous period meeting the minimum duration
    const sortedTimeSlots = [...selectedTimeSlots].sort((a, b) => a - b)
    
    const now = new Date().getTime()
    let longestContinuousDuration = 0
    let currentContinuousDuration = 0
    
    for (let i = 0; i < sortedTimeSlots.length; i++) {
      // Skip slots that are in the past
      if (sortedTimeSlots[i] < now) {
        continue
      }
      
      // Find the slot in availableTimeSlots to check if it's partial
      const slotInfo = availableTimeSlots.find(slot => slot.timestamp === sortedTimeSlots[i])
      
      if (!slotInfo) continue // Skip if slot info not found
      
      // For partial slots (current time slot), use remaining minutes instead of full 30 minutes
      const slotDuration = slotInfo.isPartial ? (slotInfo.remainingMinutes || 0) : 30
      
      if (i === 0 || sortedTimeSlots[i] - sortedTimeSlots[i-1] !== 30 * 60 * 1000) {
        // This is either the first valid slot or there's a gap
        // Reset the current duration counter
        longestContinuousDuration = Math.max(longestContinuousDuration, currentContinuousDuration)
        currentContinuousDuration = slotDuration
      } else {
        // This slot is continuous with the previous one
        currentContinuousDuration += slotDuration
      }
    }
    
    // Check one last time after the loop finishes
    longestContinuousDuration = Math.max(longestContinuousDuration, currentContinuousDuration)
    
    setHasValidDuration(longestContinuousDuration >= minDuration)
  }, [selectedTimeSlots, minDuration, availableTimeSlots])

  // Preselect timeslot(s) if timeslot param is present
  useEffect(() => {
    if (!meeting && timeslotParam && availableTimeSlots.length > 0) {
      const ts = parseInt(timeslotParam, 10)
      const slotIdx = availableTimeSlots.findIndex(slot => slot.timestamp === ts)
      const slot = availableTimeSlots[slotIdx]
      if (
        slotIdx !== -1 &&
        isSlotSelectable(slot)
      ) {
        const slotsToSelect = [slot.timestamp]
        const nextSlot = availableTimeSlots[slotIdx + 1]
        if (isSlotSelectable(nextSlot)) {
          slotsToSelect.push(nextSlot.timestamp)
        }
        setSelectedTimeSlots(slotsToSelect)
        setTimeout(() => {
          // Scroll so that the next slot (if selected) is at the bottom
          const scrollToSlot = nextSlot && slotsToSelect.includes(nextSlot.timestamp)
            ? nextSlot
            : slot
          const slotEl = document.querySelector(`[data-timeslot="${scrollToSlot?.timestamp}"]`)
          if (slotEl && formContentRef.current) {
            const formRect = formContentRef.current.getBoundingClientRect()
            const slotRect = slotEl.getBoundingClientRect()
            // Scroll so that the bottom of the slot is at the bottom of the container (minus 40px offset)
            formContentRef.current.scrollTop += (slotRect.bottom - formRect.bottom) + 10
          }
        }, 200)
      }
    }
  }, [availableTimeSlots, timeslotParam, meeting])

  if (loadingMeetingsWithPeers) return <div>{t('loading')}</div>
  if (errorMeetingsWithPeers) return <div>{t('errorLoadingMeeting')}</div>

  const toggleTimeSlot = (timestamp: number) => {
    // Don't allow toggling disabled slots
    if (availableTimeSlots.find(slot => slot.timestamp === timestamp)?.isDisabled) {
      return
    }
    
    setSelectedTimeSlots(prev => {
      if (prev.includes(timestamp)) {
        return prev.filter(t => t !== timestamp)
      } else {
        return [...prev, timestamp]
      }
    })
  }

  const handleMalesChange = (checked: boolean) => {
    if (!checked && !tempAllowedFemales) {
      setTempAllowedFemales(true)
    }
    setTempAllowedMales(checked)
  }
  
  const handleFemalesChange = (checked: boolean) => {
    if (!checked && !tempAllowedMales) {
      setTempAllowedMales(true)
    }
    setTempAllowedFemales(checked)
  }

  const handleCancel = () => {
    router.back()
  }

  const handleSave = async () => {
    await updateMeeting({
      _id: meetingId as string,
      interests: tempInterests,
      timeSlots: selectedTimeSlots,
      minDuration,
      preferEarlier,
      allowedMales: tempAllowedMales,
      allowedFemales: tempAllowedFemales,
      allowedMinAge: tempAgeRange[0],
      allowedMaxAge: tempAgeRange[1],
      languages: tempLanguages,
      peerMeetingId: meeting?.peerMeetingId || undefined
    })
    refetchFutureMeetings()
    router.back()
  }

  return (
    <div className="flex flex-col h-full panel-bg relative">
      {loading && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60"
          style={{ pointerEvents: 'all' }}
        >
          <CircularProgress color="inherit" />
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b panel-border sticky top-0 bg-inherit z-10">
        <div className="flex-grow font-semibold text-lg">
          {meeting ? t('editMeeting') : t('createMeeting')}
        </div>
        <IconButton onClick={handleCancel} size="small" aria-label={t('close')}>
          <CloseIcon />
        </IconButton>
      </div>
      {/* Scrollable Content */}
      <div ref={formContentRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 flex flex-col gap-4">
        <InterestSelector value={tempInterests} onChange={setTempInterests} />
        <Typography variant="subtitle1" className="mt-4">
          {t('languages')}
        </Typography>
        <LanguageSelector
          value={tempLanguages}
          onChange={setTempLanguages}
          label={t('Profile.iSpeak')}
        />
        {tempLanguages.length === 0 && (
          <Typography color="error" className="text-sm">
            {t('pleaseSelectLanguages')}
          </Typography>
        )}
        <Typography variant="subtitle1" className="mt-4">
          {t('preferences')}
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={tempAllowedMales}
                onChange={(e) => handleMalesChange(e.target.checked)}
              />
            }
            label={t('allowMales')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={tempAllowedFemales}
                onChange={(e) => handleFemalesChange(e.target.checked)}
              />
            }
            label={t('allowFemales')}
          />
        </FormGroup>
        <Typography>
          {t('ageRange')}: {tempAgeRange[0]} - {tempAgeRange[1]}
        </Typography>
        <div className="w-full px-2">
          <Slider
            value={tempAgeRange}
            onChange={(_, newValue) => setTempAgeRange(newValue as [number, number])}
            min={10}
            max={100}
            valueLabelDisplay="auto"
            sx={{ touchAction: 'pan-y', width: '100%', maxWidth: '100%' }}
          />
        </div>
        <FormControlLabel
          control={
            <Checkbox
              checked={preferEarlier}
              onChange={(e) => setPreferEarlier(e.target.checked)}
            />
          }
          label={t('preferEarlier')}
        />
        <Typography variant="subtitle1" className="mt-4">
          {t('minDuration')}
        </Typography>
        <div className="flex gap-4 justify-center">
          <Button 
            variant={minDuration === 30 ? "contained" : "outlined"}
            onClick={() => setMinDuration(30)}
            className="flex-1"
          >
            30 {t('minutes')}
          </Button>
          <Button 
            variant={minDuration === 60 ? "contained" : "outlined"}
            onClick={() => setMinDuration(60)}
            className="flex-1"
          >
            1 {t('hour')}
          </Button>
        </div>
        <Divider className="my-4" />
        <Typography variant="subtitle1" className="mt-4">
          {t('selectTimeSlots')}
        </Typography>
        <TimeSlotsGrid
          timeSlots={availableTimeSlots}
          selectedTimeSlots={selectedTimeSlots}
          onToggleTimeSlot={toggleTimeSlot}
        />
        {selectedTimeSlots.length === 0 && (
          <Typography color="error" className="text-sm">
            {t('pleaseSelectTimeSlots')}
          </Typography>
        )}
      </div>
      {/* Bottom Controls Bar */}
      <div className="sticky bottom-0 left-0 w-full panel-bg border-t panel-border px-4 py-3 flex justify-end gap-2 z-10">
        <div className="flex flex-col justify-start gap-2 mr-auto">
          {tempInterests.length === 0 && (
            <Typography color="warning" className="text-sm">
              {t('pleaseSelectInterest')}
            </Typography>
          )}
          {selectedTimeSlots.length > 0 && !hasValidDuration && (
            <Typography color="warning" className="text-sm">
              {t('insufficientDuration', { minutes: minDuration })}
            </Typography>
          )}
        </div>
        <Button onClick={handleCancel}>
          {t('cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || 
            selectedTimeSlots.length === 0 || 
            tempInterests.length === 0 || 
            tempLanguages.length === 0 ||
            !hasValidDuration}
        >
          {meeting ? t('update') : t('create')}
        </Button>
      </div>
    </div>
  )
} 