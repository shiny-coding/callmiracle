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
import TimeSlotsGrid, { TimeSlot } from './TimeSlotsGrid'
import LanguageSelector from './LanguageSelector'
import { getAvailableTimeSlots, isMeetingPassed } from '@/utils/meetingUtils'
import CircularProgress from '@mui/material/CircularProgress'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useMeetings } from '@/contexts/MeetingsContext'
import { SLOT_DURATION } from './MeetingsCalendar'
import LoadingDialog from './LoadingDialog'

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
  const [tempInterests, setTempInterests] = useState<Interest[]>([])
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<number[]>([])
  const [minDurationM, setMinDurationM] = useState(60)
  const [preferEarlier, setPreferEarlier] = useState(true)
  const [tempAllowedMales, setTempAllowedMales] = useState(true)
  const [tempAllowedFemales, setTempAllowedFemales] = useState(true)
  const [tempAgeRange, setTempAgeRange] = useState<[number, number]>([10, 100])
  const [tempLanguages, setTempLanguages] = useState<string[]>(currentUser?.languages || [])
  const { updateMeeting, loading } = useUpdateMeeting()
  const [hasValidDuration, setHasValidDuration] = useState(true)
  const { refetchFutureMeetings } = useMeetings()
  const formContentRef = useRef<HTMLDivElement>(null)
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([])

  useEffect(() => {
    const availableTimeSlots = getAvailableTimeSlots(meetingsWithPeers.map(m => m.meeting), meeting?._id)
    setAvailableTimeSlots(availableTimeSlots)
  }, [meetingsWithPeers, meeting])

  // Reset form when dialog opens or meeting changes
  useEffect(() => {
    if (meeting) {
      setTempInterests(meeting.interests || [])
      setSelectedTimeSlots(meeting.timeSlots || [])
      setMinDurationM(meeting.minDurationM || 60)
      setPreferEarlier(meeting.preferEarlier)
      setTempAllowedMales(meeting.allowedMales !== undefined ? meeting.allowedMales : true)
      setTempAllowedFemales(meeting.allowedFemales !== undefined ? meeting.allowedFemales : true)
      setTempAgeRange([
        meeting.allowedMinAge !== undefined ? meeting.allowedMinAge : 10,
        meeting.allowedMaxAge !== undefined ? meeting.allowedMaxAge : 100
      ])
      setTempLanguages(meeting.languages)
    }
  }, [meeting])


  // Add new useEffect to validate time slot durations
  useEffect(() => {
    if (selectedTimeSlots.length === 0) {
      setHasValidDuration(true)
      return
    }
    
    const now = new Date().getTime()
    let longestContinuousDuration = 0
    let currentContinuousDuration = 0
    
    for (let i = 0; i < selectedTimeSlots.length; i++) {
      const selectedTimeSlot = selectedTimeSlots[i]
      // Skip slots that are in the past
      if (now > selectedTimeSlot + SLOT_DURATION) continue
      const slotDuration = now > selectedTimeSlot ? SLOT_DURATION - (now - selectedTimeSlot) : SLOT_DURATION
      
      if (i === 0 || selectedTimeSlot - selectedTimeSlots[i-1] !== SLOT_DURATION) {
        // This is either the first valid slot or there's a gap reset the current duration counter
        longestContinuousDuration = Math.max(longestContinuousDuration, currentContinuousDuration)
        currentContinuousDuration = slotDuration
      } else {
        // This slot is continuous with the previous one
        currentContinuousDuration += slotDuration
      }
    }
    
    // Check one last time after the loop finishes
    longestContinuousDuration = Math.max(longestContinuousDuration, currentContinuousDuration)
    console.log('longestContinuousDuration', longestContinuousDuration / 60000)
    
    setHasValidDuration(longestContinuousDuration >= minDurationM * 60 * 1000)
  }, [selectedTimeSlots, minDurationM, availableTimeSlots])

  // Preselect timeslot(s) if timeslot param is present
  useEffect(() => {
    if (timeslotParam && availableTimeSlots.length > 0) {
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
  }, [timeslotParam, meeting, availableTimeSlots])

  if (loadingMeetingsWithPeers || errorMeetingsWithPeers) return <LoadingDialog loading={loadingMeetingsWithPeers} error={errorMeetingsWithPeers} />

  const toggleTimeSlot = (timestamp: number) => {
    // Don't allow toggling disabled slots
    if (availableTimeSlots.find(slot => slot.timestamp === timestamp)?.isDisabled) {
      return
    }
    
    setSelectedTimeSlots(prev => {
      if (prev.includes(timestamp)) {
        return prev.filter(t => t !== timestamp)
      } else {
        return [...prev, timestamp].sort((a, b) => a - b)
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
      minDurationM,
      preferEarlier,
      allowedMales: tempAllowedMales,
      allowedFemales: tempAllowedFemales,
      allowedMinAge: tempAgeRange[0],
      allowedMaxAge: tempAgeRange[1],
      languages: tempLanguages,
      peerMeetingId: meeting?.peerMeetingId || undefined,
      userId: currentUser?._id || ''
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
            variant={minDurationM === 30 ? "contained" : "outlined"}
            onClick={() => setMinDurationM(30)}
            className="flex-1"
          >
            30 {t('minutes')}
          </Button>
          <Button 
            variant={minDurationM === 60 ? "contained" : "outlined"}
            onClick={() => setMinDurationM(60)}
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
              {t('insufficientDuration', { minutes: minDurationM })}
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