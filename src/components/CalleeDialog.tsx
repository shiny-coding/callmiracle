import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, IconButton } from '@mui/material'
import CallIcon from '@mui/icons-material/Call'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import { useTranslations } from 'next-intl'
import { User, NotificationType } from '@/generated/graphql'
import CallUserInfo from './CallUserInfo'
import { useStore } from '@/store/useStore'
import { useWebRTCCallee } from '@/hooks/webrtc/useWebRTCCallee'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { usePlaySound } from '@/hooks/usePlaySound'
import { useEffect, useState, useRef } from 'react'
import { ConnectionStatus } from '@/hooks/webrtc/useWebRTCCommon'
import { useNotifications } from '@/contexts/NotificationsContext'

interface CalleeDialogProps {
  callee: any
}

export default function CalleeDialog({ callee }: CalleeDialogProps) {
  const t = useTranslations()
  const tVideoChat = useTranslations('VideoChat')
  const tStatus = useTranslations('ConnectionStatus')
  const { connectionStatus, localAudioEnabled, localVideoEnabled, setLocalAudioEnabled, setLocalVideoEnabled, pendingMissedCall } = useStore((state) => ({
    connectionStatus: state.connectionStatus,
    localAudioEnabled: state.localAudioEnabled,
    localVideoEnabled: state.localVideoEnabled,
    setLocalAudioEnabled: state.setLocalAudioEnabled,
    setLocalVideoEnabled: state.setLocalVideoEnabled,
    pendingMissedCall: state.pendingMissedCall
  }))
  const { doCall } = useWebRTCContext()
  const { notifications, setNotificationSeen } = useNotifications()

  // Preserve caller information even after call expires
  const [lastIncomingRequest, setLastIncomingRequest] = useState<any>(null)

  useEffect(() => {
    if (callee.incomingRequest) {
      setLastIncomingRequest(callee.incomingRequest)
    }
  }, [callee.incomingRequest])

  const isMissedCall = connectionStatus === ConnectionStatus.TIMEOUT || connectionStatus === ConnectionStatus.EXPIRED
  // Don't show CalleeDialog's missed call view if MissedCallDialog is handling it
  const open = !!callee.incomingRequest || (isMissedCall && !pendingMissedCall)
  const isReceivingCall = connectionStatus === ConnectionStatus.RECEIVING_CALL
  const user = callee.incomingRequest?.from || lastIncomingRequest?.from || null
  const onAccept = callee.handleAcceptCall
  const onReject = callee.handleRejectCall

  const meetingId = callee.incomingRequest?.meetingId || lastIncomingRequest?.meetingId
  const meetingLastCallTime = callee.incomingRequest?.meetingLastCallTime || lastIncomingRequest?.meetingLastCallTime
  const showUserInfo = !meetingId || meetingLastCallTime

  const isConnecting = connectionStatus === ConnectionStatus.CONNECTING

  const { play: playRingingSound, stop: stopRingingSound } = usePlaySound('/sounds/sfx-calling.mp3', { loop: true, resumeOnVisibilityChange: true })

  // Track which notifications we've already marked as seen to avoid duplicate calls
  const markedNotificationsRef = useRef<Set<string>>(new Set())

  // Mark the corresponding missed call notification as seen when showing the missed call dialog
  useEffect(() => {
    if (isMissedCall && user) {
      // Find the most recent unseen MISSED_CALL notification from this caller
      const missedCallNotification = notifications.find(
        (n: any) =>
          n.type === NotificationType.MissedCall &&
          !n.seen &&
          n.peerUserName === user.name &&
          !markedNotificationsRef.current.has(n._id)
      )

      if (missedCallNotification) {
        markedNotificationsRef.current.add(missedCallNotification._id)
        setNotificationSeen(missedCallNotification._id)
      }
    }
  }, [isMissedCall, user, notifications, setNotificationSeen])

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
      PaperProps={{
        className: 'card-bg text-color min-w-[300px]'
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
      <DialogTitle className="text-center">
        {isMissedCall
          ? (showUserInfo
              ? t('notificationMessages.missedCallTitle')
              : t('notificationMessages.missedCallAnonymous'))
          : tStatus(connectionStatus)}
      </DialogTitle>
      <DialogContent>
        {meetingId && (
          <Typography variant="subtitle1" className="mb-4 text-blue-400">
            {t('meetingCall')}
          </Typography>
        )}
        {showUserInfo && <CallUserInfo user={user} compact={isMissedCall} />}
        {!isMissedCall && (
          <div className="flex justify-center gap-4 mt-4">
            <IconButton
              onClick={() => setLocalAudioEnabled(!localAudioEnabled)}
              className="icon-gradient-blue"
              size="large"
            >
              {localAudioEnabled ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
            <IconButton
              onClick={() => setLocalVideoEnabled(!localVideoEnabled)}
              className="icon-gradient-blue"
              size="large"
            >
              {localVideoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
          </div>
        )}
      </DialogContent>
      <DialogActions className="border-t brighter-border">
        {isMissedCall ? (
          <>
            <Button onClick={handleClose} variant="contained" color="inherit">
              {t('close')}
            </Button>
            <Button onClick={handleCallBack} variant="contained" color="success" startIcon={<CallIcon sx={{ color: 'white' }} />}>
              {t('callback')}
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
              }} variant="contained" color="success" startIcon={<CallIcon sx={{ color: 'white' }} />}>
                {tVideoChat('accept')}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  )
} 