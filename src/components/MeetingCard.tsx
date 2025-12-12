'use client'
import { Typography, Chip, Button, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TimerIcon from '@mui/icons-material/Timer'
import VideocamIcon from '@mui/icons-material/Videocam'
import EditIcon from '@mui/icons-material/Edit'
import MoodIcon from '@mui/icons-material/Mood'
import GroupIcon from '@mui/icons-material/Group'
import WcIcon from '@mui/icons-material/Wc'
import CakeIcon from '@mui/icons-material/Cake'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { MeetingWithPeer, User, MeetingTransparency } from '@/generated/graphql'
import { formatDuration } from '@/utils/formatDuration'
import { isMeetingPassed, getSharedInterests, class2Hex, ACTIVE_MEETING_COLOR, PASSED_MEETING_COLOR, SCHEDULED_MEETING_COLOR, FINDING_MEETING_COLOR, getMeetingColorClass, canEditMeeting, meetingIsActiveNow, getLateAllowance } from '@/utils/meetingUtils'
import React, { useEffect, useState } from 'react'
import DoneIcon from '@mui/icons-material/Done'
import CancelIcon from '@mui/icons-material/Cancel'
import { useMutation } from '@apollo/client'
import { MeetingStatus } from '@/generated/graphql'
import { UPDATE_MEETING_LAST_CALL, useMeetingCardUtils } from './MeetingCardUtils'
import { differenceInSeconds, isWithinInterval } from 'date-fns'
import { differenceInHours } from 'date-fns'
import ConfirmDialog from './ConfirmDialog'
import { combineAdjacentSlots } from '@/utils/meetingUtils'
import { useMeetings } from '@/contexts/MeetingsContext'
import { useGroups } from '@/store/GroupsProvider'
import { useProfileImage } from '@/hooks/useProfileImage'
import Image from 'next/image'
import UserDetailsPopup from './UserDetailsPopup'

interface MeetingCardProps {
  meetingWithPeer: MeetingWithPeer
  onEdit?: (e?: React.MouseEvent) => void
}


export default function MeetingCard({ meetingWithPeer, onEdit }: MeetingCardProps) {
  const t = useTranslations()
  const locale = useLocale()
  const now = new Date()
  const { doCall } = useWebRTCContext()
  const [, setLastUpdate] = useState(0)
  const meeting = meetingWithPeer.meeting
  const [updateMeetingStatus] = useMutation(UPDATE_MEETING_LAST_CALL)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const { refetchMeetings } = useMeetings()
  const [confirmAction, setConfirmAction] = useState<'finish' | 'cancel' | null>(null)
  const { groups } = useGroups()
  const { imageSrc: peerImageSrc } = useProfileImage(meetingWithPeer.peerUser?._id)
  const [userDetailsOpen, setUserDetailsOpen] = useState(false)

  // Check if meeting has passed using the utility function
  const meetingPassed = isMeetingPassed(meeting);
  const meetingColor = getMeetingColorClass(meeting);
  const meetingColorHex = class2Hex(meetingColor);

  const { formatTimeSlot, formatDateForDisplay, getFirstSlotDay, groupTimeSlotsByDay, MeetingLanguagesChips, GenderChip,
          getPartnerIcon } = useMeetingCardUtils(meetingWithPeer as any, meetingColor, t, locale)

  // Get the group name
  const meetingGroup = groups?.find(group => group._id === meeting.groupId)

  // Reusable chip styling for passed vs active meetings
  const getChipSx = (isActive = isActiveNow) => ({
    '&.MuiChip-filled': {
      backgroundColor: 'transparent',
    },
    backgroundColor: 'transparent',
    color: meetingColorHex,
    border: isActive
      ? `1px solid ${class2Hex(ACTIVE_MEETING_COLOR)}`
      : `1px solid ${meetingColorHex}`,
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
    if (meetingIsActiveNow(meeting)) {
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
  const isActiveNow = meetingIsActiveNow(meeting);
  const soonChipSx = getChipSx()
  if ( meetingStatusLabels.status === 'soon' ) {
    soonChipSx.border = `1px solid ${class2Hex(ACTIVE_MEETING_COLOR)} !important`
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
      // For CallerDialog: pass lastCallTime or 1 for transparent meetings (to show peer name)
      const meetingLastCallTime = meetingWithPeer.meeting.lastCallTime ||
        (meetingWithPeer.meeting.transparency === MeetingTransparency.Transparent ? 1 : null)
      doCall(meetingWithPeer.peerUser as User, meetingWithPeer.meeting._id, meetingLastCallTime)
    }
  }

  const interestsToShow = getSharedInterests(meeting, meetingWithPeer.peerMeeting)

  const openConfirmDialog = (action: 'finish' | 'cancel') => {
    setConfirmAction(action)
    setConfirmDialogOpen(true)
  }

  const closeConfirmDialog = () => {
    setConfirmDialogOpen(false)
    setConfirmAction(null)
  }

  const handleFinishMeeting = async () => { openConfirmDialog('finish') }

  const handleCancelMeeting = async () => { openConfirmDialog('cancel') }

  const confirmMeetingAction = async () => {
    try {
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
      closeConfirmDialog()
      refetchMeetings(true)
    } catch (error) {
      console.error(`Error ${confirmAction}ing meeting:`, error)
      closeConfirmDialog()
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full relative">
      {(meeting.status === MeetingStatus.Seeking || meeting.status === MeetingStatus.Found) && !meetingPassed && (
        <div className="absolute top-0 left-0">
          <IconButton
            className="icon-gradient p-1"
            onClick={(e) => {
              e.stopPropagation();
              handleCancelMeeting();
            }}
            size="small"
          >
            <CancelIcon fontSize="small" />
          </IconButton>
        </div>
      )}
      <div className="absolute top-0 right-0">
        {canEditMeeting(meeting) && (
          <IconButton
            className="icon-gradient p-1"
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
                  : isActiveNow
                    ? t('readyToCallPartner')
                    : ( t('partnerFound') + ' ' + getPartnerIcon() )
          }
        </Typography>
      </div>

      {meeting.peerMeetingId && meeting.startTime && meetingWithPeer.peerUser && (
        <div className="flex flex-col items-center gap-2 mt-2">
          {isActiveNow && (
            <Button
              variant="contained"
              size="small"
              startIcon={<VideocamIcon sx={{ color: class2Hex(ACTIVE_MEETING_COLOR) }} />}
              onClick={handleCallPeer}
              className="text-white font-semibold"
              sx={{
                background: 'var(--icon-gradient)',
                px: 2,
                '&:hover': {
                  background: 'var(--icon-gradient)',
                  filter: 'brightness(1.1)',
                }
              }}
            >
              {t('call')}
            </Button>
          )}
          {(meeting.lastCallTime || meeting.transparency === MeetingTransparency.Transparent) && (
            <div
              className="flex items-center gap-2 cursor-pointer hover:opacity-80"
              onClick={() => setUserDetailsOpen(true)}
            >
              <div className="relative w-8 h-8 flex-shrink-0 overflow-hidden rounded-full">
                {peerImageSrc ? (
                  <Image
                    src={peerImageSrc}
                    alt={meetingWithPeer.peerUser.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-blue-600 text-white text-sm font-semibold">
                    {meetingWithPeer.peerUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <Typography variant="body2" className={meetingPassed ? "text-gray-400 mobile-semibold" : "mobile-semibold"}>
                {meetingWithPeer.peerUser.name}
              </Typography>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-center gap-2">
        <AccessTimeIcon sx={{ color: class2Hex(meetingColor) }} fontSize="small" />
        <div className="flex flex-wrap items-center gap-2">
          {meeting.startTime && !meetingPassed &&
            <>
              <Chip
                label={meetingStatusLabels.timeText || formatDateForDisplay(new Date(meeting.startTime))}
                size="small"
                className="text-xs mobile-semibold"
                sx={soonChipSx}
              />
            </>
          }
          {!meeting.startTime && !meetingPassed ? (
            <>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 w-full">
                  {Object.entries(timeSlotsByDay).map(([day, slots], index) => {
                    const combinedSlots = combineAdjacentSlots(slots)
                    
                    if (combinedSlots.length === 0) return null;

                    const minDurationMs = meeting.minDurationM * 60 * 1000;
                    const allowanceMs = getLateAllowance(meeting.minDurationM);
                    const displayableSlots = combinedSlots.filter(slot => 
                      now.getTime() <= slot.end - minDurationMs + allowanceMs
                    );

                    if (displayableSlots.length === 0) return null;

                    return (
                      <React.Fragment key={day}>
                        <Typography variant="body2" className="whitespace-nowrap flex items-center h-6 mobile-semibold" sx={{ color: meetingColorHex }}>
                          {day}
                        </Typography>
                        <div className="grid grid-cols-[repeat(auto-fill,110px)] gap-1">
                          {displayableSlots.map(({start, end}, slotIndex) => {
                            const isActive = isWithinInterval(now, {
                              start: new Date(start),
                              end: new Date(end)
                            }) && !!meeting.peerMeetingId

                            return (
                              <Chip
                                key={`${start}-${end}`}
                                label={formatTimeSlot(start, end)}
                                size="small"
                                className="text-xs mobile-semibold"
                                sx={getChipSx(isActive)}
                              />
                            )
                          })}
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>
              </>
            ) : null
          }
          {meetingPassed && (
            <Chip
              label={getFirstSlotDay()}
              size="small"
              className="text-xs text-white bg-gray-500 mobile-semibold"
              sx={getChipSx(false)}
            />
          )}
        </div>        
    </div>
      <div className="flex items-center justify-center gap-2">
        <GroupIcon sx={{ color: class2Hex(meetingColor) }} fontSize="small" />
        <Typography variant="body2" className="mobile-semibold" sx={{ color: meetingColorHex }}>
          {meetingGroup?.name || t('group')}
        </Typography>
      </div>
      <div className="flex items-center justify-center gap-2">
        <MoodIcon sx={{ color: class2Hex(meetingColor) }} fontSize="small" />
        <div className="flex flex-wrap gap-2">
        {interestsToShow && interestsToShow.map(interest => (
          <Chip
            key={interest}
            label={interest}
            size="small"
            className="text-xs mobile-semibold"
            sx={getChipSx()}
          />
        ))}
        </div>
      </div>
      <MeetingLanguagesChips meetingColor={meetingColor} chipSx={getChipSx()} />
      {!meeting.peerMeetingId && meeting.status !== MeetingStatus.Cancelled && meeting.status !== MeetingStatus.Finished && !meetingPassed && (
        <>
          {!(meeting.allowedMales && meeting.allowedFemales) && (
            <div className="flex items-center justify-center gap-2">
              <WcIcon sx={{ color: class2Hex(meetingColor) }} fontSize="small" />
              <GenderChip />
            </div>
          )}
          {!(meeting.allowedMinAge === 10 && meeting.allowedMaxAge === 100) && (
            <div className="flex items-center justify-center gap-2">
              <CakeIcon sx={{ color: class2Hex(meetingColor) }} fontSize="small" />
              <Typography variant="body2" className="mobile-semibold" sx={{ color: meetingColorHex }}>
                {meeting.allowedMinAge}-{meeting.allowedMaxAge}
              </Typography>
            </div>
          )}
        </>
      )}

      {meeting.totalDurationS && (
        <div className="flex items-center justify-center gap-2">
          <TimerIcon sx={{ color: class2Hex(meetingColor) }} />
          <Typography variant="body2" className="mobile-semibold" sx={{ color: meetingColorHex }}>
            {t('totalDuration')}: {formatDuration(meeting.totalDurationS)}
          </Typography>
        </div>
      )}

      {!meetingPassed && meeting.status === MeetingStatus.Called && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="contained"
            color="warning"
            startIcon={<DoneIcon />}
            onClick={handleFinishMeeting}
            size="small"
          >
            {t('finishMeeting')}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialogOpen}
        title={
          confirmAction === 'finish' ? t('confirmFinishTitle') : t('confirmCancelTitle')
        }
        message={
          confirmAction === 'finish' ? t('confirmFinishMessage') : t('confirmCancelMessage')
        }
        onConfirm={confirmMeetingAction}
        onCancel={closeConfirmDialog}
      />

      {meetingWithPeer.peerUser && (
        <UserDetailsPopup
          user={meetingWithPeer.peerUser as User}
          open={userDetailsOpen}
          onClose={() => setUserDetailsOpen(false)}
        />
      )}
    </div>
  )
} 