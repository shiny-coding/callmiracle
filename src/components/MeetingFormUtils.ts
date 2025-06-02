import { MeetingOutput, MeetingStatus } from "@/generated/graphql";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SLOT_DURATION, getSlotDuration, getLateAllowance } from '@/utils/meetingUtils'
import { TimeSlot } from "./TimeSlotsGrid";
import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { UPDATE_MEETING_LAST_CALL } from './MeetingCardUtils'; // Assuming this is the correct path

export function handleMeetingSaveResult(
  result: MeetingOutput,
  t: any,
  refetchMeetings: () => void,
  meetingToConnectId: string | null,
  meetingId: string | string[] | undefined,
  router: AppRouterInstance,
  locale: string,
  showSnackbar: (message: string, type: 'success' | 'error') => void
) {

  if (result && result.error) {
    // Use t() to translate the error key
    const errorMessage = t(`MeetingErrors.${result.error}`)
    showSnackbar(errorMessage, 'error')
  } else {
    // No error reported, or result implies success
    refetchMeetings()
    let message;
    if (meetingToConnectId) {
      message = t('meetingConnected')
    } else if (meetingId) {
      if (result.meeting?.peerMeetingId) {
        message = t('meetingUpdatedAndConnected')
      } else {
        message = t('meetingUpdated')
      }
    } else {
      if (result.meeting?.peerMeetingId) {
        message = t('meetingCreatedAndConnected')
      } else {
        message = t('meetingCreated')
      }
    }
    showSnackbar(message, 'success')
    router.push(`/${locale}/list`)
  }
}

export function calculateHasValidDuration(
  timeSlots: number[],
  minDurationM: number
): boolean {
  if (timeSlots.length === 0) {
    return true
  }

  const now = new Date().getTime()
  let longestContinuousDuration = 0
  let currentContinuousDuration = 0

  // timeSlots is expected to be sorted
  for (let i = 0; i < timeSlots.length; i++) {
    const timeSlot = timeSlots[i]
    // Skip slots that are in the past
    if (now > timeSlot + SLOT_DURATION) continue
    const slotDuration = getSlotDuration(timeSlot)

    if (i === 0 || timeSlot - timeSlots[i - 1] !== SLOT_DURATION) {
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
  const allowance = getLateAllowance(minDurationM)
  return longestContinuousDuration >= minDurationM * 60 * 1000 - allowance
}

export function trySelectHourSlots(timeslot: number, availableTimeSlots: TimeSlot[]) {
  const slotIndex = Math.max(availableTimeSlots.findIndex(slot => slot.timestamp === timeslot), 0)
  const slot = availableTimeSlots[slotIndex]
  const slotsToSelect: number[] = []
  const HOUR_DURATION = 60 * 60 * 1000
  let slotsToSelectDuration = 0
  if ( slot && !slot.isDisabled ) {
    slotsToSelect.push(slot.timestamp)
    slotsToSelectDuration += getSlotDuration(slot.timestamp)
    const nextSlot = availableTimeSlots[slotIndex + 1]
    if (nextSlot && !nextSlot.isDisabled) {
      slotsToSelect.push(nextSlot.timestamp)
      slotsToSelectDuration += getSlotDuration(nextSlot.timestamp)
      if (slotsToSelectDuration < HOUR_DURATION) {
        const nextNextSlot = availableTimeSlots[slotIndex + 2]
        if (nextNextSlot && !nextNextSlot.isDisabled) {
          slotsToSelect.push(nextNextSlot.timestamp)
          slotsToSelectDuration += getSlotDuration(nextNextSlot.timestamp)
        }
      }
    }
  }
  return slotsToSelect
}

export function useCancelMeeting(
  t: any, 
  refetchMeetings: () => void, 
  router: AppRouterInstance, 
  showSnackbar: (message: string, type: 'success' | 'error') => void
) {
  const [updateMeetingStatus, { loading: isCancellingMeeting }] = useMutation(UPDATE_MEETING_LAST_CALL)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  const handleOpenCancelDialog = () => {
    setConfirmCancelOpen(true)
  }

  const handleCloseCancelDialog = () => {
    setConfirmCancelOpen(false)
  }

  const handleConfirmCancelMeeting = async (meetingId: string) => {
    if (!meetingId) return

    try {
      await updateMeetingStatus({
        variables: {
          input: {
            _id: meetingId,
            status: MeetingStatus.Cancelled
          }
        }
      })
      showSnackbar(t('meetingCancelledSuccess'), 'success')
      refetchMeetings()
      router.back()
    } catch (error) {
      console.error('Error cancelling meeting:', error)
      showSnackbar(t('meetingCancelError'), 'error')
    } finally {
      handleCloseCancelDialog()
    }
  }

  return {
    isCancellingMeeting,
    confirmCancelOpen,
    handleOpenCancelDialog,
    handleCloseCancelDialog,
    handleConfirmCancelMeeting
  }
}
