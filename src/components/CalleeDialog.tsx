import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import CallUserInfo from './CallUserInfo'
import { useStore } from '@/store/useStore'
import { useWebRTCCallee } from '@/hooks/webrtc/useWebRTCCallee'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { usePlaySound } from '@/hooks/usePlaySound'
import { useEffect, useState } from 'react'
import { ConnectionStatus } from '@/hooks/webrtc/useWebRTCCommon'

interface CalleeDialogProps {
  callee: any
}

export default function CalleeDialog({ callee }: CalleeDialogProps) {
  const t = useTranslations()
  const tVideoChat = useTranslations('VideoChat')
  const tStatus = useTranslations('ConnectionStatus')
  const { connectionStatus } = useStore((state) => ({
    connectionStatus: state.connectionStatus
  }))
  const { doCall } = useWebRTCContext()

  // Preserve caller information even after call expires
  const [lastIncomingRequest, setLastIncomingRequest] = useState<any>(null)

  useEffect(() => {
    if (callee.incomingRequest) {
      setLastIncomingRequest(callee.incomingRequest)
    }
  }, [callee.incomingRequest])

  const isMissedCall = connectionStatus === ConnectionStatus.TIMEOUT || connectionStatus === ConnectionStatus.EXPIRED
  const open = !!callee.incomingRequest || isMissedCall
  const isReceivingCall = connectionStatus === ConnectionStatus.RECEIVING_CALL
  const user = callee.incomingRequest?.from || lastIncomingRequest?.from || null
  const onAccept = callee.handleAcceptCall
  const onReject = callee.handleRejectCall

  const meetingId = callee.incomingRequest?.meetingId || lastIncomingRequest?.meetingId
  const meetingLastCallTime = callee.incomingRequest?.meetingLastCallTime || lastIncomingRequest?.meetingLastCallTime
  const showUserInfo = !meetingId || meetingLastCallTime

  const isConnecting = connectionStatus === ConnectionStatus.CONNECTING

  const { play: playRingingSound, stop: stopRingingSound } = usePlaySound('/sounds/sfx-calling.mp3', { loop: true })

  useEffect(() => {
    if (open && connectionStatus === ConnectionStatus.RECEIVING_CALL) {
      playRingingSound()
    } else {
      stopRingingSound()
    }
  }, [open, connectionStatus])

  const handleClose = () => {
    callee.setIncomingRequest(null)
    setLastIncomingRequest(null)
  }

  const handleCallBack = async () => {
    if (user && meetingId) {
      handleClose()
      await doCall(user, meetingId, meetingLastCallTime)
    }
  }

  if (!user) return null

  return (
    <Dialog
      open={open}
      onClose={isMissedCall ? handleClose : onReject}
      hideBackdrop={isReceivingCall}
      PaperProps={{
        className: 'bg-gray-900 text-white min-w-[300px]'
      }}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)'
          }
        }
      }}
    >
      <DialogTitle className="flex justify-between items-center">
        {isMissedCall
          ? (showUserInfo
              ? t('notificationMessages.missedCall', { name: user.name })
              : t('notificationMessages.missedCallAnonymous'))
          : tStatus(connectionStatus)}
      </DialogTitle>
      <DialogContent>
        {meetingId && (
          <Typography variant="subtitle1" className="mb-4 text-blue-400">
            {t('meetingCall')}
          </Typography>
        )}
        {showUserInfo && <CallUserInfo user={user} />}
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        {isMissedCall ? (
          <>
            <Button onClick={handleClose} variant="contained" color="inherit">
              {t('close')}
            </Button>
            <Button onClick={handleCallBack} variant="contained" color="success">
              {t('callAgain')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onReject} variant="contained" color="error">
              {tVideoChat('reject')}
            </Button>
            {!isConnecting && (
              <Button onClick={() => {
                onAccept()
              }} variant="contained" color="success">
                {tVideoChat('accept')}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  )
} 