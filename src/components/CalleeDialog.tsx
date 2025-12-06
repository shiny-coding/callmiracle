import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, IconButton } from '@mui/material'
import CallIcon from '@mui/icons-material/Call'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import SettingsIcon from '@mui/icons-material/Settings'
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
import { gql, useQuery } from '@apollo/client'
import clientLogger from '@/utils/clientLogger'

const GET_USER = gql`
  query GetUserForMissedCall($userId: ID!) {
    getUser(userId: $userId) {
      _id
      name
      languages
      about
      sex
      birthYear
    }
  }
`

interface CalleeDialogProps {
  callee: any
}

export default function CalleeDialog({ callee }: CalleeDialogProps) {
  const t = useTranslations()
  const tVideoChat = useTranslations('VideoChat')
  const tStatus = useTranslations('ConnectionStatus')
  const { connectionStatus, localAudioEnabled, localVideoEnabled, setLocalAudioEnabled, setLocalVideoEnabled, pendingMissedCall, setPendingMissedCall, targetUser, setConnectionStatus, setDeviceSettingsOpen } = useStore((state) => ({
    connectionStatus: state.connectionStatus,
    localAudioEnabled: state.localAudioEnabled,
    localVideoEnabled: state.localVideoEnabled,
    setLocalAudioEnabled: state.setLocalAudioEnabled,
    setLocalVideoEnabled: state.setLocalVideoEnabled,
    pendingMissedCall: state.pendingMissedCall,
    setPendingMissedCall: state.setPendingMissedCall,
    targetUser: state.targetUser,
    setConnectionStatus: state.setConnectionStatus,
    setDeviceSettingsOpen: state.setDeviceSettingsOpen
  }))
  const { doCall } = useWebRTCContext()
  const { notifications, setNotificationSeen } = useNotifications()

  // Fetch user for pending missed call from notification
  const { data: pendingUserData, loading: pendingUserLoading } = useQuery(GET_USER, {
    variables: { userId: pendingMissedCall?.peerUserId },
    skip: !pendingMissedCall?.peerUserId
  })
  const pendingMissedCallUser = pendingUserData?.getUser

  // Preserve caller information even after call expires
  const [lastIncomingRequest, setLastIncomingRequest] = useState<any>(null)

  useEffect(() => {
    if (callee.incomingRequest) {
      setLastIncomingRequest(callee.incomingRequest)
    }
  }, [callee.incomingRequest])

  const isMissedCallFromStatus = connectionStatus === ConnectionStatus.TIMEOUT || connectionStatus === ConnectionStatus.EXPIRED
  const isMissedCallFromNotification = !!pendingMissedCall && !!pendingMissedCallUser
  const isMissedCall = isMissedCallFromStatus || isMissedCallFromNotification
  const isReceivingCall = connectionStatus === ConnectionStatus.RECEIVING_CALL

  // Keep the dialog/sound active as soon as we enter RECEIVING_CALL, even if the offer hasn't arrived yet
  const hasIncomingOrRingingState = isReceivingCall || !!callee.incomingRequest
  const open = hasIncomingOrRingingState || (isMissedCallFromStatus && !pendingMissedCall) || isMissedCallFromNotification

  // User source: notification user takes priority, then incoming request, then last request
  const user = isMissedCallFromNotification
    ? pendingMissedCallUser
    : (callee.incomingRequest?.from || lastIncomingRequest?.from || targetUser || null)
  const onAccept = callee.handleAcceptCall
  const onReject = callee.handleRejectCall

  const meetingId = isMissedCallFromNotification
    ? pendingMissedCall?.meetingId
    : (callee.incomingRequest?.meetingId || lastIncomingRequest?.meetingId)
  const meetingLastCallTime = callee.incomingRequest?.meetingLastCallTime || lastIncomingRequest?.meetingLastCallTime
  const showUserInfo = !meetingId || meetingLastCallTime || isMissedCallFromNotification

  const isConnecting = connectionStatus === ConnectionStatus.CONNECTING

  const { play: playRingingSound, stop: stopRingingSound } = usePlaySound('/sounds/sfx-calling.mp3', { loop: true, resumeOnVisibilityChange: true })
  const handleDeviceSettings = () => setDeviceSettingsOpen(true)

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
    clientLogger.info('[CalleeDialog] Sound effect triggered', {
      open,
      connectionStatus,
      isReceivingCall: connectionStatus === ConnectionStatus.RECEIVING_CALL,
      shouldPlay: open && connectionStatus === ConnectionStatus.RECEIVING_CALL
    })
    if (open && connectionStatus === ConnectionStatus.RECEIVING_CALL) {
      clientLogger.info('[CalleeDialog] Calling playRingingSound()')
      playRingingSound()
    } else {
      clientLogger.info('[CalleeDialog] Calling stopRingingSound()')
      stopRingingSound()
    }
  }, [open, connectionStatus, playRingingSound, stopRingingSound])

  const handleClose = () => {
    if (isMissedCallFromNotification) {
      setPendingMissedCall(null)
    } else {
      callee.setIncomingRequest(null)
      setLastIncomingRequest(null)
    }
    // Ensure dialog closes for missed-call states
    if (isMissedCall) {
      setConnectionStatus(ConnectionStatus.DISCONNECTED)
    }
  }

  const handleCallBack = () => {
    if (user) {
      const userToCall = user
      const meetingIdToUse = meetingId || null
      const meetingLastCallTimeToUse = isMissedCallFromNotification ? null : meetingLastCallTime
      handleClose()
      // Use setTimeout to ensure dialog closes before CallerDialog opens
      setTimeout(() => {
        doCall(userToCall, meetingIdToUse, meetingLastCallTimeToUse)
      }, 100)
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
          <IconButton
            onClick={handleDeviceSettings}
            className="icon-gradient-blue"
            size="large"
            title={t('deviceSettings', { defaultMessage: 'Settings' })}
          >
            <SettingsIcon />
          </IconButton>
        </div>
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
