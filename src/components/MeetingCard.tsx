import { Typography, Chip, Button, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TimerIcon from '@mui/icons-material/Timer'
import VideocamIcon from '@mui/icons-material/Videocam'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import MoodIcon from '@mui/icons-material/Mood'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { Interest, User } from '@/generated/graphql'
import { formatDuration } from '@/utils/formatDuration'
import { isMeetingPassed, getSharedInterests, class2Hex } from '@/utils/meetingUtils'
import React, { useEffect, useState } from 'react'
import DoneIcon from '@mui/icons-material/Done'
import CancelIcon from '@mui/icons-material/Cancel'
import { useMutation } from '@apollo/client'
import { MeetingStatus } from '@/generated/graphql'
import { UPDATE_MEETING_LAST_CALL, useMeetingCardUtils } from './MeetingCardUtils'
import { differenceInSeconds, isWithinInterval } from 'date-fns'
import { differenceInHours } from 'date-fns'
import ConfirmDialog from './ConfirmDialog'
import { useDeleteMeeting } from '@/hooks/useDeleteMeeting'

interface MeetingCardProps {
  meetingWithPeer: {
    meeting: {
      _id: string
      userId: string
      languages: string[]
      interests: Interest[]
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
      status: MeetingStatus
      totalDuration: number
    }
    peerMeeting?: {
      userId: string
      languages: string[]
      interests: Interest[]
    }
    peerUser?: {
      _id: string
      name: string
      sex: string
      languages: string[]
    }
  }
  onEdit?: (e?: React.MouseEvent) => void
  refetch: () => void
}


export default function MeetingCard({ meetingWithPeer, onEdit, refetch }: MeetingCardProps) {
  const t = useTranslations()
  const tInterest = useTranslations('Interest')
  const now = new Date()
  const { doCall } = useWebRTCContext()
  const [, setLastUpdate] = useState(0)
  const meeting = meetingWithPeer.meeting
  const [updateMeetingStatus] = useMutation(UPDATE_MEETING_LAST_CALL)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'finish' | 'cancel' | 'delete' | null>(null)

  // Check if meeting has passed using the utility function
  const meetingPassed = isMeetingPassed(meeting);
  const textColor = meetingPassed ? "text-gray-400" : "text-gray-300";
  const { deleteMeeting } = useDeleteMeeting()

  const { formatTimeSlot, formatDateForDisplay, getFirstSlotDay, groupTimeSlotsByDay, combineAdjacentSlots, MeetingLanguagesChips, GenderChip,
          getPartnerIcon } = useMeetingCardUtils(meetingWithPeer as any, textColor, now, t)

  const activeColor = 'text-green-400' // '#4ADE80'
  const passedColor = 'text-gray-400' // '#9CA3AF'
  const scheduledColor = 'text-yellow-400' // '#FBBF24'
  const findingColor = 'text-blue-500' // '#3B82F6'

  // Determine meeting color based on its state
  const getMeetingColor = () => {
    if (meetingPassed) return passedColor; 
    
    if (meeting.startTime) {
      const meetingEndTime = new Date(Math.max(meeting.startTime + meeting.minDuration * 60 * 1000, (meeting.lastCallTime ?? 0) + 10 * 60 * 1000));
      // Meeting is currently active
      if (now < meetingEndTime && now >= new Date(meeting.startTime)) return activeColor
      // Meeting is scheduled but not yet started
      return scheduledColor
    }
    
    // Finding partner
    return findingColor; 
  };
  
  const meetingColor = getMeetingColor();

  // Reusable chip styling for passed vs active meetings
  const getChipSx = (isActive = isActiveNow) => ({
    backgroundColor: isActive 
      ? 'transparent !important' 
      : meetingPassed
        ? 'transparent !important' 
        : '#4B5563 !important',
    color: meetingPassed
      ? `${class2Hex(passedColor)} !important` 
      : 'white !important',
    border: isActive 
      ? `2px solid ${class2Hex(activeColor)} !important` 
      : meetingPassed
        ? `2px solid ${class2Hex(passedColor)} !important` 
        : `2px solid ${class2Hex(meetingColor)} !important`,
  });

  const timeSlotsByDay = groupTimeSlotsByDay()
  
  // Check meeting status more precisely
  const getMeetingStatusLabels = () => {
    if (!meeting.startTime) return { status: 'not-scheduled', timeText: '' };

    if (meeting.status === MeetingStatus.Cancelled) {
      return { status: 'cancelled', timeText: t('meetingCancelled') };
    }
    if (meeting.status === MeetingStatus.Finished) {
      return { status: 'finished', timeText: t('meetingFinished') };
    }
    
    const startDate = new Date(meeting.startTime);
    const threeHoursAfterStart = new Date(meeting.startTime + 3 * 60 * 60 * 1000);
    
    // Meeting is happening now
    if (now >= startDate && !meetingPassed) {
      return { status: 'now', timeText: t('now') };
    }
    
    // Meeting is in the past but still within 3 hours window
    if (meetingPassed && now <= threeHoursAfterStart) {
      return { status: 'recent', timeText: t('recentlyEnded') };
    }
    
    // Meeting is in the future
    if (now < startDate) {
      const diffSeconds = differenceInSeconds(startDate, now);
      const diffHours = differenceInHours(startDate, now);
      
      if (diffHours < 8) {
        if (diffHours < 1) {
          // Less than 1 hour
          const mins = Math.max(1, Math.ceil(diffSeconds / 60))
          return { 
            status: 'soon', 
            timeText: t('startsInMinutes', { minutes: mins }),
            updatePeriod: 30 * 1000 // each 30 seconds
          };
        } else if (diffHours < 3) {
          // Less than 3 hours
          const hours = Math.floor(diffHours);
          const mins = Math.floor((diffSeconds % (60 * 60)) / 60);
          return { 
            status: 'upcoming', 
            timeText: t('startsInHoursMinutes', { hours, minutes: mins }),
            updatePeriod: 10 * 60 * 1000 // each 10 mins
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
  
  const meetingStatusLabels = getMeetingStatusLabels();
  const isActiveNow = meetingStatusLabels.status === 'now';
  const soonChipSx = getChipSx()
  if ( meetingStatusLabels.status === 'soon' ) {
    soonChipSx.border = `2px solid ${class2Hex(activeColor)} !important`
  }

  useEffect(() => {
    if ( !meetingStatusLabels.updatePeriod ) return;
    const updateInterval = setInterval(() => {
      // rerendering MeetingCard to update time
      setLastUpdate(Date.now())
    }, meetingStatusLabels.updatePeriod)
    return () => clearInterval(updateInterval)
  }, [meetingStatusLabels.updatePeriod])

  const handleCallPeer = () => {
    if (meetingWithPeer.peerUser && meetingWithPeer.peerUser._id) {
      console.log('calling peer', meetingWithPeer.peerUser, meetingWithPeer.meeting._id)
      // If this is a first call (no lastCallTime), don't show user info
      doCall(meetingWithPeer.peerUser as User, false, meetingWithPeer.meeting._id, meetingWithPeer.meeting.lastCallTime ?? null)
    }
  }

  const interestsToShow = getSharedInterests(meeting, meetingWithPeer.peerMeeting)

  const openConfirmDialog = (action: 'finish' | 'cancel' | 'delete') => {
    setConfirmAction(action)
    setConfirmDialogOpen(true)
  }

  const closeConfirmDialog = () => {
    setConfirmDialogOpen(false)
    setConfirmAction(null)
  }

  const handleFinishMeeting = async () => { openConfirmDialog('finish') }

  const handleCancelMeeting = async () => { openConfirmDialog('cancel') }

  const handleDeleteConfirm = () => { openConfirmDialog('delete') }

  const confirmMeetingAction = async () => {
    try {
      if (confirmAction === 'delete') {
        // Call the passed onDelete handler
        await deleteMeeting(meeting._id)
      } else {
        await updateMeetingStatus({
          variables: {
            input: {
              _id: meeting._id,
              status: confirmAction === 'finish' 
                ? MeetingStatus.Finished 
                : MeetingStatus.Cancelled
            }
          }
        })
      }
      closeConfirmDialog()
      refetch()
    } catch (error) {
      console.error(`Error ${confirmAction}ing meeting:`, error)
      closeConfirmDialog()
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full relative">
      <div className="absolute top-0 right-0">
        {(meeting.status === MeetingStatus.Cancelled || (meeting.status === MeetingStatus.Seeking && !meetingPassed)) && (
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
        {meetingPassed &&
          <IconButton 
            className="text-red-400 hover:bg-gray-600 p-1"
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteConfirm()
            }}
            size="small"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        }
      </div>
      {/* <div className="absolute top-4 left-0">{meeting._id}</div> */}

      <div className="flex items-center justify-center">
        <Typography variant="subtitle2" 
          className="font-bold"
          sx={{ color: class2Hex(meetingColor), fontWeight: 'bold' }}
        >
          {meeting.status === MeetingStatus.Cancelled
            ? t('meetingCancelled')
            : meeting.status === MeetingStatus.Finished
              ? t('meetingFinished')
              : meetingPassed 
                ? t('meetingPassed')
                : meeting.status === MeetingStatus.Seeking 
                  ? t('findingPartner')                
                  : ( t('partnerFound') + ' ' + getPartnerIcon() )
          }
        </Typography>
      </div>

      {meeting.peerMeetingId && meeting.startTime && (
        <div className="flex flex-col gap-1">
          {meetingWithPeer.peerUser && (
            <div className="flex items-center justify-center gap-2 mt-2">

              {isActiveNow && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<VideocamIcon />}
                  onClick={handleCallPeer}
                  className="text-white"
                  sx={{
                    backgroundColor: `${class2Hex(activeColor)} !important`, // light green
                    '&:hover': {
                      backgroundColor: '#22C55E !important', // slightly darker green on hover
                    }
                  }}
                >
                  {t('call')}
                </Button>
              )}
              {meeting.lastCallTime ? (
                <div className="flex items-center gap-1">
                  <Typography variant="body2" className={meetingPassed ? "text-gray-400" : "text-gray-200"}>
                    {meetingWithPeer.peerUser.name}
                  </Typography>
                </div>
              ) : null}
            </div>
          )}
          
        </div>
      )}
      <div className="flex items-center gap-2">
        <AccessTimeIcon className={meetingColor} fontSize="small" />
        <div className="flex flex-wrap items-center gap-2 w-full">
          {meeting.startTime && !meetingPassed &&
            <>
              <Chip
                label={meetingStatusLabels.timeText || formatDateForDisplay(new Date(meeting.startTime))}
                size="small"
                className={`text-xs`}
                sx={soonChipSx}
              />
              {!meetingPassed &&
                <Typography variant="body2" className={`${textColor} flex items-center pl-1`}>
                  {meeting.minDuration} {t('min')}
                </Typography>
              }
            </>
          }
          {!meeting.startTime && !meetingPassed ? (
            <>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 w-full">
                  {Object.entries(timeSlotsByDay).map(([day, slots], index) => {
                    const combinedSlots = combineAdjacentSlots(slots)
                    
                    if (combinedSlots.length === 0) return null;
                    const isLastEntry = index === Object.entries(timeSlotsByDay).length - 1
                    return (
                      <React.Fragment key={day}>
                        <Typography variant="body2" className={`${textColor} whitespace-nowrap flex items-center h-6`}>
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
                            <Typography variant="body2" className={`${textColor} flex items-center pl-1`}>
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
          }
          {meetingPassed && meeting.totalDuration && meeting.totalDuration > 0 && (
            <Chip
              label={`${t('callDuration')}: ${formatDuration(meeting.totalDuration)}`}
              size="small"
              className={`text-xs text-white bg-gray-500`}
            />
          )}
          {meetingPassed && (
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
        <MoodIcon className={meetingColor} fontSize="small" />
        <div className="flex flex-wrap gap-2">
        {interestsToShow && interestsToShow.map(interest => (
          <Chip
            key={interest}
            label={tInterest(interest)}
            size="small"
            className="text-xs"
            sx={getChipSx()}
          />
        ))}
        </div>
      </div>
      <MeetingLanguagesChips meetingColor={meetingColor} chipSx={getChipSx()} />
      {!meeting.peerMeetingId && (
        <div className="flex items-center gap-2">
          <GenderChip />
          <Typography variant="body2" className={textColor}>
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

      {!meetingPassed && meeting.status === MeetingStatus.Called ? (
        <div className="flex items-center gap-2">
          <Button
            className="max-w-min"
            variant="contained"
            color="warning"
            startIcon={<DoneIcon />}
            onClick={handleFinishMeeting}
            size="small"
          >
            {t('finishMeeting')}
          </Button>
        </div>
      ) : (meeting.status === MeetingStatus.Seeking || meeting.status === MeetingStatus.Found) && !meetingPassed && (
        <div className="flex mt-2 items-center gap-2">
          <Button
            className="max-w-min"
            variant="contained"
            color="warning"
            startIcon={<CancelIcon />}
            onClick={handleCancelMeeting}
            size="small"
          >
            {t('cancelMeeting')}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialogOpen}
        title={
          confirmAction === 'finish' ? t('confirmFinishTitle') : 
          confirmAction === 'cancel' ? t('confirmCancelTitle') :
          t('deleteMeeting')
        }
        message={
          confirmAction === 'finish' ? t('confirmFinishMessage') : 
          confirmAction === 'cancel' ? t('confirmCancelMessage') :
          t('confirmDeleteMeeting')
        }
        onConfirm={confirmMeetingAction}
        onCancel={closeConfirmDialog}
      />
    </div>
  )
} 