import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import CallUserInfo from './CallUserInfo'
import { useStore } from '@/store/useStore'
import { useWebRTCCallee } from '@/hooks/webrtc/useWebRTCCallee'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { usePlaySound } from '@/hooks/usePlaySound'
import { useEffect } from 'react'
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

  const isReconnecting = connectionStatus === ConnectionStatus.RECONNECTING || connectionStatus === ConnectionStatus.NEED_RECONNECT
  const open = isReconnecting || !!callee.incomingRequest
  const isReceivingCall = connectionStatus === ConnectionStatus.RECEIVING_CALL
  const user = callee.incomingRequest?.from || null
  const onAccept = callee.handleAcceptCall
  const onReject = callee.handleRejectCall

  const meetingId = callee.incomingRequest?.meetingId
  const meetingLastCallTime = callee.incomingRequest?.meetingLastCallTime
  const showUserInfo = !meetingId || meetingLastCallTime

  const isConnecting = connectionStatus === ConnectionStatus.CONNECTING
  const onCancelReconnect = callee.hangup

  const { play: playRingingSound, stop: stopRingingSound } = usePlaySound('/sounds/sfx-calling.mp3', { loop: true })

  useEffect(() => {
    if (open && connectionStatus === ConnectionStatus.RECEIVING_CALL) {
      playRingingSound()
    } else {
      stopRingingSound()
    }
  }, [open, connectionStatus])

  // Auto-dismiss dialog when call ends or expires
  useEffect(() => {
    const shouldDismiss =
      connectionStatus === ConnectionStatus.TIMEOUT ||
      connectionStatus === ConnectionStatus.EXPIRED ||
      connectionStatus === ConnectionStatus.FINISHED ||
      connectionStatus === ConnectionStatus.REJECTED ||
      connectionStatus === ConnectionStatus.FAILED ||
      connectionStatus === ConnectionStatus.BUSY ||
      connectionStatus === ConnectionStatus.NO_ANSWER ||
      connectionStatus === ConnectionStatus.DISCONNECTED

    if (callee.incomingRequest && shouldDismiss) {
      console.log('CalleeDialog: Auto-dismissing due to connection status:', connectionStatus)
      callee.setIncomingRequest(null)
    }
  }, [connectionStatus, callee])

  if (!user) return null

  return (
    <Dialog
      open={open}
      onClose={onReject}
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
        {tStatus(connectionStatus)}
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
        {!isReconnecting && (
        <Button onClick={onReject} variant="contained" color="error">
          {tVideoChat('reject')}
          </Button>
        )}
        {!isReconnecting && !isConnecting && (
          <Button onClick={() => {
            onAccept(null)
          }} variant="contained" color="success">
            {tVideoChat('accept')}
          </Button>
        )}
        {isReconnecting && (
        <Button onClick={onCancelReconnect} variant="contained" color="warning">
          {t('cancel')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
} 