import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import UserCard from './UserCard'
import { useStore } from '@/store/useStore'
import { useWebRTCCallee } from '@/hooks/webrtc/useWebRTCCallee'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { usePlaySound } from '@/hooks/usePlaySound'
import { useEffect } from 'react'

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

  const isReconnecting = connectionStatus === 'reconnecting' || connectionStatus === 'need-reconnect'
  const open = isReconnecting || !!callee.incomingRequest
  const user = callee.incomingRequest?.from || null
  const onAccept = callee.handleAcceptCall
  const onReject = callee.handleRejectCall

  const meetingId = callee.incomingRequest?.meetingId
  const meetingLastCallTime = callee.incomingRequest?.meetingLastCallTime
  const showUserInfo = !meetingId || meetingLastCallTime

  const isConnecting = connectionStatus === 'connecting'
  const onCancelReconnect = callee.hangup

  const { play: playRingingSound, stop: stopRingingSound } = usePlaySound('/sounds/sfx-calling.mp3', { loop: true })

  useEffect(() => {
    if (open && connectionStatus === 'receiving-call') {
      playRingingSound()
    } else {
      stopRingingSound()
    }
  }, [open, connectionStatus])

  if (!user) return null

  return (
    <Dialog 
      open={open}
      onClose={onReject}
      PaperProps={{
        className: 'bg-gray-900 text-white min-w-[300px]'
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
        {showUserInfo && <UserCard user={user} />}
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        {!isReconnecting && (
        <Button onClick={onReject} variant="contained" color="error">
          {tVideoChat('reject')}
          </Button>
        )}
        {!isReconnecting && !isConnecting && (
          <Button onClick={() => onAccept(null)} variant="contained" color="success">
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