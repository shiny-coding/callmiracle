'use client'

import { IconButton, Button, FormGroup, FormControlLabel, Checkbox, Slider, Typography, Divider, Snackbar, Alert, Paper, Box } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CancelIcon from '@mui/icons-material/Cancel'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useLocale, useTranslations } from 'next-intl'
import { useUpdateMeeting } from '@/hooks/useUpdateMeeting'
import { useStore } from '@/store/useStore'
import { useState, useEffect, ChangeEvent, useRef, useMemo } from 'react'
import { Meeting, MeetingStatus, MeetingTransparency } from '@/generated/graphql'
import { NetworkStatus } from '@apollo/client'
import InterestSelector from './InterestSelector'
import TimeSlotsGrid, { TimeSlot } from './TimeSlotsGrid'
import SingleGroupSelector from './SingleGroupSelector'
import { getAvailableTimeSlots, getTimeSlotsFromMeeting, isMeetingPassed } from '@/utils/meetingUtils'
import CircularProgress from '@mui/material/CircularProgress'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useMeetings } from '@/contexts/MeetingsContext'
import { useGroups } from '@/store/GroupsProvider'
import LoadingDialog from './LoadingDialog'
import ConfirmDialog from './ConfirmDialog'
import { useSnackbar } from '@/contexts/SnackContext'
import { handleMeetingSaveResult, calculateHasValidDuration, trySelectHourSlots, useCancelMeeting } from './MeetingFormUtils'
import PageHeader from './PageHeader'
import UserAvatar from './UserAvatar'
import UserDetailsPopup from './UserDetailsPopup'
import { LANGUAGES } from '@/config/languages'

export default function MeetingForm() {
  const t = useTranslations()

  const { myMeetingsWithPeers, loadingMyMeetingsWithPeers, errorMyMeetingsWithPeers, futureMeetingsWithPeers, loadingFutureMeetingsWithPeers, errorFutureMeetingsWithPeers, networkStatusMyMeetings, networkStatusFutureMeetings } = useMeetings()
  const { groups, loading: loadingGroups, error: errorGroups } = useGroups()

  const { id: meetingId } = useParams()
  const meeting = myMeetingsWithPeers.find(m => m.meeting._id === meetingId)?.meeting

  const { currentUser, lastMeetingGroup, setLastMeetingGroup } = useStore(state => ({
    currentUser: state.currentUser,
    lastMeetingGroup: state.lastMeetingGroup,
    setLastMeetingGroup: state.setLastMeetingGroup
  }))
  const router = useRouter()

  const searchParams = useSearchParams()
  const timeslotParam = searchParams?.get('timeslot')
  const meetingToConnectId = searchParams?.get('meetingToConnectId')
  const meetingWithPeerToConnect = futureMeetingsWithPeers.find(m => m.meeting._id === meetingToConnectId)
  const meetingToConnect = meetingWithPeerToConnect?.meeting

  // Track if meeting became unavailable after initial load
  const [meetingBecameUnavailable, setMeetingBecameUnavailable] = useState(false)
  const [initialMeetingToConnectFound, setInitialMeetingToConnectFound] = useState(false)

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
  const [showNameInCalendar, setShowNameInCalendar] = useState<boolean>(false)
  const [userDetailsPopupOpen, setUserDetailsPopupOpen] = useState(false)
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

  // Determine if we are joining and which sex to allow
  const joiningSex = meetingWithPeerToConnect?.peerUser?.sex

  // Detect if a meeting that was supposed to be connected to became unavailable
  useEffect(() => {
    if (loadingFutureMeetingsWithPeers) return

    // If we have meetingToConnectId in URL
    if (meetingToConnectId) {
      // If meeting was found, mark it
      if (meetingToConnect) {
        setInitialMeetingToConnectFound(true)
      }
      // If meeting was initially found but now it's gone, mark as unavailable
      else if (initialMeetingToConnectFound && !meetingToConnect) {
        setMeetingBecameUnavailable(true)
      }
    }
  }, [meetingToConnectId, meetingToConnect, initialMeetingToConnectFound, loadingFutureMeetingsWithPeers])

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
      setShowNameInCalendar(meeting.transparency === MeetingTransparency.Transparent)
    } else if (meetingToConnect) {
      // Connecting to existing meeting
      setSelectedGroupId(meetingToConnect.groupId || '')
      setMinDurationM(meetingToConnect.minDurationM || 60)
    } else {
      // Creating new meeting
      // If user belongs to only one group, automatically select it
      if (userGroups.length === 1) {
        setSelectedGroupId(userGroups[0]._id)
      }
      // Otherwise use lastMeetingGroup if available and user is still in that group
      else if (lastMeetingGroup && currentUser?.groups?.includes(lastMeetingGroup)) {
        setSelectedGroupId(lastMeetingGroup)
      }
      setShowNameInCalendar(false)
    }
  }, [meeting, meetingToConnect, lastMeetingGroup, currentUser?.groups, userGroups])

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

  

  const isInitialLoading = (networkStatusMyMeetings === NetworkStatus.loading) || 
                        (meetingToConnectId && networkStatusFutureMeetings === NetworkStatus.loading) ||
                        loadingGroups

  if (isInitialLoading || errorMyMeetingsWithPeers || errorGroups ||
    (meetingToConnectId && errorFutureMeetingsWithPeers)) {
    return <LoadingDialog loading={isInitialLoading} error={errorMyMeetingsWithPeers || errorFutureMeetingsWithPeers || errorGroups} />
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

  const handleUserClick = () => {
    setUserDetailsPopupOpen(true)
  }

  const handleCloseUserDetails = () => {
    setUserDetailsPopupOpen(false)
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

    // Filter interests to only include those that belong to the selected group
    const groupInterests = selectedGroup?.interestsPairs?.flat() || []
    const filteredInterests = tempInterests.filter(interest => groupInterests.includes(interest))

    // Determine meeting transparency based on group setting and user choice
    let meetingTransparency = selectedGroup?.transparency
    if (selectedGroup?.transparency === MeetingTransparency.Mixed) {
      meetingTransparency = showNameInCalendar ? MeetingTransparency.Transparent : MeetingTransparency.Opaque
    }

    const meetingInput = {
      _id: meetingId as string,
      groupId: selectedGroupId,
      interests: filteredInterests,
      timeSlots: selectedTimeSlots,
      minDurationM,
      preferEarlier,
      allowedMales: tempAllowedMales,
      allowedFemales: tempAllowedFemales,
      allowedMinAge: tempAgeRange[0],
      allowedMaxAge: tempAgeRange[1],
      language: selectedGroup?.language || 'en',
      peerMeetingId: meeting?.peerMeetingId || undefined,
      userId: currentUser?._id || '',
      meetingToConnectId,
      transparency: meetingTransparency as any
    }
    const result = await updateMeeting(meetingInput)
    handleMeetingSaveResult(result, t, refetchMeetings, meetingToConnectId, meetingId, router, locale, showSnackbar)
  }

  return (
    <Paper className="flex flex-col h-full relative">
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
        className="sticky top-0 z-10"
      >
        <IconButton onClick={handleCancel} size="small" aria-label={t('close')} title={t('close')}>
          <CloseIcon />
        </IconButton>
      </PageHeader>

      {/* Meeting No Longer Available Message */}
      {meetingBecameUnavailable && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 flex items-center justify-center">
          <Paper elevation={3} className="p-8 max-w-md w-full text-center">
            <ErrorOutlineIcon
              sx={{ fontSize: 64, color: 'error.main', mb: 2 }}
            />
            <Typography variant="h5" gutterBottom className="font-semibold">
              {t('meetingNoLongerAvailable')}
            </Typography>
            <Typography variant="body1" color="text.secondary" className="mb-4">
              {t('meetingNoLongerAvailableDescription')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<ArrowBackIcon />}
              onClick={() => router.back()}
              fullWidth
            >
              {t('returnToCalendar')}
            </Button>
          </Paper>
        </div>
      )}

      {/* Scrollable Content */}
      {!meetingBecameUnavailable && (
        <div ref={formContentRef} className="flex-1 overflow-y-auto overflow-x-hidden px-12sp flex flex-col gap-4">
        {/* User Info Display - only show when connecting to transparent meeting */}
        {meetingToConnect && meetingToConnect.transparency === MeetingTransparency.Transparent && meetingWithPeerToConnect?.peerUser && (
          <div className="flex items-center gap-3 p-3 rounded-lg">
            <UserAvatar user={meetingWithPeerToConnect.peerUser} size="lg" />
            <div className="flex-1">
              <Typography variant="body2" color="text.secondary">
                {t('meetingWith')}
              </Typography>
              <Typography 
                variant="body1" 
                className="font-medium cursor-pointer hover:underline"
                onClick={handleUserClick}
              >
                {meetingWithPeerToConnect.peerUser.name}
              </Typography>
            </div>
          </div>
        )}

        {/* Group Selector */}
        {meetingToConnect ? (
          <div>
            <Typography variant="subtitle1" className="mb-2">
              {t('group')}
            </Typography>
            <Typography variant="body1" className="p-3 rounded-lg">
              {userGroups.find(group => group._id === meetingToConnect.groupId)?.name || t('unknownGroup')}
            </Typography>
          </div>
        ) : userGroups.length > 1 ? (
          <>
            <SingleGroupSelector
              value={selectedGroupId}
              onChange={setSelectedGroupId}
              label={t('selectGroup')}
              availableGroups={userGroups}
            />
            {selectedGroupId && selectedGroup && (
              <Typography variant="body2" color="text.secondary" className="text-sm mt-1">
                {t('language')}: {LANGUAGES.find(lang => lang.code === selectedGroup.language)?.name || selectedGroup.language}
              </Typography>
            )}
          </>
        ) : null}
        {!selectedGroupId && !meetingToConnect && userGroups.length > 1 && (
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
          {/* Transparency checkbox - only show if group transparency is MIXED and not connecting to existing meeting */}
          {selectedGroup?.transparency === MeetingTransparency.Mixed && !meetingToConnect && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={showNameInCalendar}
                  onChange={(e) => setShowNameInCalendar(e.target.checked)}
                />
              }
              label={t('showMyNameNextToMeetingInCalendar')}
            />
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
      )}

      {/* Bottom Controls Bar */}
      {!meetingBecameUnavailable && (
      <div className="sticky bottom-0 left-0 w-full border-t panel-border px-12sp py-3 flex justify-end gap-2 z-10 flex-wrap">
        {meeting && !isMeetingPassed(meeting) && (
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
          {!selectedGroupId && userGroups.length > 1 ? (
            <Typography color="warning" className="text-sm">
              {t('pleaseSelectGroup')}
            </Typography>
          ) : selectedGroupId && tempInterests.length === 0 ? (
            <Typography color="warning" className="text-sm">
              {t('pleaseSelectInterest')}
            </Typography>
          ) : selectedGroupId && tempInterests.length > 0 && selectedTimeSlots.length === 0 ? (
            <Typography color="warning" className="text-sm">
              {t('selectAdjacentSlots', { minutes: minDurationM })}
            </Typography>
          ) : selectedTimeSlots.length > 0 && !hasValidDuration ? (
            <Typography color="warning" className="text-sm">
              {t('insufficientDuration', { minutes: minDurationM })}
            </Typography>
          ) : null}
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
            !hasValidDuration}
        >
          {meeting ? t('update') : meetingToConnect ? t('connectWithMeeting') : t('create')}
        </Button>
      </div>
      )}

      <ConfirmDialog
        open={confirmCancelOpen}
        title={t('confirmCancelTitle')}
        message={t('confirmCancelMessage')}
        onConfirm={() => meeting?._id && handleConfirmCancelMeeting(meeting._id)}
        onCancel={handleCloseCancelDialog}
      />
      {meetingWithPeerToConnect?.peerUser?._id && (
        <UserDetailsPopup
          user={meetingWithPeerToConnect.peerUser}
          open={userDetailsPopupOpen}
          onClose={handleCloseUserDetails}
        />
      )}
    </Paper>
  )
} 