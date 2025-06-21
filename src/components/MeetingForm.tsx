import { IconButton, Button, FormGroup, FormControlLabel, Checkbox, Slider, Typography, Divider, Snackbar, Alert } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CancelIcon from '@mui/icons-material/Cancel'
import { useLocale, useTranslations } from 'next-intl'
import { useUpdateMeeting } from '@/hooks/useUpdateMeeting'
import { useStore } from '@/store/useStore'
import { useState, useEffect, ChangeEvent, useRef, useMemo } from 'react'
import { Meeting, MeetingStatus } from '@/generated/graphql'
import InterestSelector from './InterestSelector'
import TimeSlotsGrid, { TimeSlot } from './TimeSlotsGrid'
import LanguageSelector from './LanguageSelector'
import SingleGroupSelector from './SingleGroupSelector'
import { getAvailableTimeSlots, getTimeSlotsFromMeeting } from '@/utils/meetingUtils'
import CircularProgress from '@mui/material/CircularProgress'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useMeetings } from '@/contexts/MeetingsContext'
import { useGroups } from '@/store/GroupsProvider'
import LoadingDialog from './LoadingDialog'
import ConfirmDialog from './ConfirmDialog'
import { useSnackbar } from '@/contexts/SnackContext'
import { handleMeetingSaveResult, calculateHasValidDuration, trySelectHourSlots, useCancelMeeting } from './MeetingFormUtils'
import PageHeader from './PageHeader'

export default function MeetingForm() {
  const t = useTranslations()

  const { myMeetingsWithPeers, loadingMyMeetingsWithPeers, errorMyMeetingsWithPeers, futureMeetingsWithPeers, loadingFutureMeetingsWithPeers, errorFutureMeetingsWithPeers } = useMeetings()
  const { groups, loading: loadingGroups, error: errorGroups } = useGroups()

  const { id: meetingId } = useParams()
  const meeting = myMeetingsWithPeers.find(m => m.meeting._id === meetingId)?.meeting

  const { currentUser, lastMeetingGroup, setLastMeetingGroup, lastMeetingLanguage, setLastMeetingLanguage } = useStore(state => ({ 
    currentUser: state.currentUser,
    lastMeetingGroup: state.lastMeetingGroup,
    setLastMeetingGroup: state.setLastMeetingGroup,
    lastMeetingLanguage: state.lastMeetingLanguage,
    setLastMeetingLanguage: state.setLastMeetingLanguage
  }))
  const router = useRouter()

  const searchParams = useSearchParams()
  const timeslotParam = searchParams?.get('timeslot')
  const meetingToConnectId = searchParams?.get('meetingToConnectId')
  const meetingWithPeerToConnect = futureMeetingsWithPeers.find(m => m.meeting._id === meetingToConnectId)
  const meetingToConnect = meetingWithPeerToConnect?.meeting
  const interestToMatch = searchParams?.get('interest')

  // Get groups current user is in - memoize to prevent infinite re-renders
  const userGroups = useMemo(() => 
    groups?.filter(group => currentUser?.groups?.includes(group._id)) || [],
    [groups, currentUser?.groups]
  )

  const [preselectedTimeSlots, setPreselectedTimeSlots] = useState<boolean>(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [tempInterests, setTempInterests] = useState<string[]>([])
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<number[]>([])
  const [minDurationM, setMinDurationM] = useState(60)
  const [preferEarlier, setPreferEarlier] = useState(true)
  const [tempAllowedMales, setTempAllowedMales] = useState(true)
  const [tempAllowedFemales, setTempAllowedFemales] = useState(true)
  const [tempAgeRange, setTempAgeRange] = useState<[number, number]>([10, 100])
  const [tempLanguages, setTempLanguagesState] = useState<string[]>(
    lastMeetingLanguage || currentUser?.languages || []
  )
  
  // Wrapper function to save to store when languages change
  const setTempLanguages = (languages: string[]) => {
    setTempLanguagesState(languages)
    setLastMeetingLanguage(languages.length > 0 ? languages : null)
  }
  const { updateMeeting, loading } = useUpdateMeeting()
  const [hasValidDuration, setHasValidDuration] = useState(true)
  const { refetchMeetings } = useMeetings()
  const formContentRef = useRef<HTMLDivElement>(null)
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([])
  const locale = useLocale()

  const { showSnackbar } = useSnackbar()

  // Get the selected group object for InterestSelector
  const selectedGroup = userGroups.find(group => group._id === selectedGroupId)

  const {
    isCancellingMeeting,
    confirmCancelOpen,
    handleOpenCancelDialog,
    handleCloseCancelDialog,
    handleConfirmCancelMeeting
  } = useCancelMeeting(t, refetchMeetings, router, showSnackbar)

  // Add these derived values
  const preselectedInterest = (
    meetingToConnect && interestToMatch
      ? interestToMatch
      : undefined
  )

  // Determine if we are joining and which sex to allow
  const joiningSex = meetingWithPeerToConnect?.peerUser?.sex

  useEffect(() => {
    if (loadingMyMeetingsWithPeers || loadingFutureMeetingsWithPeers) return
    const myMeetings = myMeetingsWithPeers.map(m => m.meeting)
    const availableTimeSlots = meetingToConnect
      ? getTimeSlotsFromMeeting(myMeetings, meetingToConnect.timeSlots)
      : getAvailableTimeSlots(myMeetings, meeting?._id)

    if (meetingToConnect) {
      const hasValidDuration = calculateHasValidDuration(meetingToConnect.timeSlots, minDurationM)
      if (!hasValidDuration) {
        showSnackbar(t('meetingPassedCannotConnect'), 'error')
        router.back()
      }
    }

    setAvailableTimeSlots(availableTimeSlots)
  }, [myMeetingsWithPeers, meeting, meetingToConnect, loadingMyMeetingsWithPeers, loadingFutureMeetingsWithPeers])

  // Reset form when dialog opens or meeting changes
  useEffect(() => {
    if (meeting) {
      // Editing existing meeting
      setSelectedGroupId(meeting.groupId || '')
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
      setTempLanguagesState(meeting.languages)
    } else if (meetingToConnect) {
      // Connecting to existing meeting
      setSelectedGroupId(meetingToConnect.groupId || '')
      setMinDurationM(meetingToConnect.minDurationM || 60)
      if (preselectedInterest) {
        setTempInterests([preselectedInterest])
      }
    } else {
      // Creating new meeting - use lastMeetingGroup if available and user is still in that group
      if (lastMeetingGroup && currentUser?.groups?.includes(lastMeetingGroup)) {
        setSelectedGroupId(lastMeetingGroup)
      }
    }
  }, [meeting, preselectedInterest, meetingToConnect, lastMeetingGroup, currentUser?.groups])

  // Clear interests when group changes (unless it's the initial load)
  useEffect(() => {
    if (selectedGroupId && !meeting && !meetingToConnect) {
      setTempInterests([])
    }
  }, [selectedGroupId, meeting, meetingToConnect])

  // Add new useEffect to validate time slot durations
  useEffect(() => {
    setHasValidDuration(calculateHasValidDuration(selectedTimeSlots, minDurationM))
  }, [selectedTimeSlots, minDurationM])

  // Preselect timeslot(s) if timeslot param is present
  useEffect(() => {
    if (timeslotParam && availableTimeSlots.length > 0 && !preselectedTimeSlots) {
      setPreselectedTimeSlots(true)
      const timeslot = parseInt(timeslotParam, 10)
      const slotsToSelect = trySelectHourSlots(timeslot, availableTimeSlots)
      
      if (slotsToSelect.length > 0) {
        setSelectedTimeSlots(slotsToSelect)
        setTimeout(() => {
          // Scroll so that the next slot (if selected) is at the bottom
          const scrollToSlot = slotsToSelect[slotsToSelect.length - 1]
          const slotEl = document.querySelector(`[data-timeslot="${scrollToSlot}"]`)
          if (slotEl && formContentRef.current) {
            const formRect = formContentRef.current.getBoundingClientRect()
            const slotRect = slotEl.getBoundingClientRect()
            // Scroll so that the bottom of the slot is at the bottom of the container (minus 40px offset)
            formContentRef.current.scrollTop += (slotRect.bottom - formRect.bottom) + 10
          }
        }, 200)
      }
    }
  }, [timeslotParam, meeting, availableTimeSlots, preselectedTimeSlots])

  

  if (loadingMyMeetingsWithPeers || errorMyMeetingsWithPeers || loadingGroups || errorGroups ||
    (meetingToConnectId && (loadingFutureMeetingsWithPeers || errorFutureMeetingsWithPeers))) {
    return <LoadingDialog loading={loadingMyMeetingsWithPeers || loadingFutureMeetingsWithPeers || loadingGroups} error={errorMyMeetingsWithPeers || errorFutureMeetingsWithPeers || errorGroups} />
  }

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
    if (!selectedGroupId) {
      showSnackbar(t('pleaseSelectGroup'), 'error')
      return
    }

    // Remember the selected group for new meetings
    if (!meeting) {
      setLastMeetingGroup(selectedGroupId)
    }

    const meetingInput = {
      _id: meetingId as string,
      groupId: selectedGroupId,
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
      userId: currentUser?._id || '',
      meetingToConnectId,
      transparency: selectedGroup?.transparency as any
    }
    const result = await updateMeeting(meetingInput)
    handleMeetingSaveResult(result, t, refetchMeetings, meetingToConnectId, meetingId, router, locale, showSnackbar)
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
      <PageHeader 
        title={meetingToConnectId ? t('connectWithMeeting') : meeting ? t('editMeeting') : t('createMeeting')}
        className="sticky top-0 bg-inherit z-10"
      >
        <IconButton onClick={handleCancel} size="small" aria-label={t('close')} title={t('close')}>
          <CloseIcon />
        </IconButton>
      </PageHeader>
      {/* Scrollable Content */}
      <div ref={formContentRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 flex flex-col gap-4">
        {/* Group Selector */}
        <SingleGroupSelector
          value={selectedGroupId}
          onChange={setSelectedGroupId}
          label={t('selectGroup')}
          availableGroups={userGroups}
        />
        {!selectedGroupId && (
          <Typography color="error" className="text-sm">
            {t('pleaseSelectGroup')}
          </Typography>
        )}

        {/* Interest Selector - only show if group is selected */}
        {selectedGroup && (
          <InterestSelector
            value={tempInterests}
            onChange={setTempInterests}
            interestsPairs={selectedGroup.interestsPairs || []}
            interestsToMatch={meetingToConnect?.interests}
          />
        )}
        {selectedGroupId && tempInterests.length === 0 && (
          <Typography color="warning" className="text-sm">
            {t('pleaseSelectInterest')}
          </Typography>
        )}

        <Typography variant="subtitle1" className="mt-4">
          {t('languages')}
        </Typography>
        <LanguageSelector
          value={tempLanguages}
          onChange={setTempLanguages}
          availableLanguages={meetingToConnect?.languages}
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
          {meetingToConnect ? (
            joiningSex === 'male' ? (
              <FormControlLabel
                control={
                  <Checkbox checked disabled />
                }
                label={t('allowMales')}
              />
            ) : joiningSex === 'female' ? (
              <FormControlLabel
                control={
                  <Checkbox checked disabled />
                }
                label={t('allowFemales')}
              />
            ) : null
          ) : (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={tempAllowedMales}
                    onChange={e => handleMalesChange(e.target.checked)}
                  />
                }
                label={t('allowMales')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={tempAllowedFemales}
                    onChange={e => handleFemalesChange(e.target.checked)}
                  />
                }
                label={t('allowFemales')}
              />
            </>
          )}
        </FormGroup>
        {!meetingToConnect &&
          <>
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
          </>
        }
        <Typography variant="subtitle1" className="mt-4">
          {t('minDuration')}
        </Typography>
        <div className="flex gap-4 justify-start">
          <Button
            variant={minDurationM === 30 ? 'contained' : 'outlined'}
            onClick={() => !meetingToConnect && setMinDurationM(30)}
            className="flex-0 basis-1/2"
            disabled={!!meetingToConnect && minDurationM !== 30}
            style={{ display: meetingToConnect && minDurationM !== 30 ? 'none' : undefined }}
          >
            30 {t('minutes')}
          </Button>
          <Button
            variant={minDurationM === 60 ? 'contained' : 'outlined'}
            onClick={() => !meetingToConnect && setMinDurationM(60)}
            className="flex-0 basis-1/2"
            disabled={!!meetingToConnect && minDurationM !== 60}
            style={{ display: meetingToConnect && minDurationM !== 60 ? 'none' : undefined }}
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
        {meeting && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<CancelIcon />}
            onClick={handleOpenCancelDialog}
            disabled={loading || isCancellingMeeting}
            className="mr-auto"
          >
            {t('cancelMeetingButton')}
          </Button>
        )}
        <div className="flex flex-col justify-start gap-2 mr-auto">
          {!selectedGroupId && (
            <Typography color="warning" className="text-sm">
              {t('pleaseSelectGroup')}
            </Typography>
          )}
          {selectedGroupId && tempInterests.length === 0 && (
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
            isCancellingMeeting ||
            !selectedGroupId ||
            selectedTimeSlots.length === 0 || 
            tempInterests.length === 0 || 
            tempLanguages.length === 0 ||
            !hasValidDuration}
        >
          {meeting ? t('update') : t('create')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmCancelOpen}
        title={t('confirmCancelTitle')}
        message={t('confirmCancelMessage')}
        onConfirm={() => meeting?._id && handleConfirmCancelMeeting(meeting._id)}
        onCancel={handleCloseCancelDialog}
      />
    </div>
  )
} 