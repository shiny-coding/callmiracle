import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material'
import CallIcon from '@mui/icons-material/Call'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import CallUserInfo from './CallUserInfo'
import { syncStore, useStore, vanillaStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { usePlaySound } from '@/hooks/usePlaySound'
import { MAX_CALLING_TIME_MS } from '@/config/constants'

export default function CallerDialog() {
  const t = useTranslations()
  const { connectionStatus, setConnectionStatus, targetUser, meetingId, meetingLastCallTime, currentUser, localAudioEnabled, localVideoEnabled, setLocalAudioEnabled, setLocalVideoEnabled, pendingMissedCall } = useStore( (state: any) => ({
    connectionStatus: state.connectionStatus,
    setConnectionStatus: state.setConnectionStatus,
    targetUser: state.targetUser,
    meetingId: state.meetingId,
    meetingLastCallTime: state.meetingLastCallTime,
    currentUser: state.currentUser,
    localAudioEnabled: state.localAudioEnabled,
    localVideoEnabled: state.localVideoEnabled,
    setLocalAudioEnabled: state.setLocalAudioEnabled,
    setLocalVideoEnabled: state.setLocalVideoEnabled,
    pendingMissedCall: state.pendingMissedCall
  }))
  const tStatus = useTranslations('ConnectionStatus')
  const { doCall, callUser, caller } = useWebRTCContext()
  // Don't show CallerDialog if MissedCallDialog is handling a notification click
  const open = !!targetUser && connectionStatus && ['calling', 'connecting', 'busy', 'no-answer'].includes(connectionStatus) && !pendingMissedCall
  const isCalling = connectionStatus === 'calling'
  const { play: playCallingSound, stop: stopCallingSound } = usePlaySound('/sounds/sfx-calling.mp3', { loop: true, resumeOnVisibilityChange: true })

  const sendExpired = useCallback(async () => {
    const { targetUser, callId, setCallId } = syncStore()
    if (callId && targetUser) {
      console.log('Sending expired', callId)
      await callUser({
        variables: {
          input: {
            type: 'expired',
            targetUserId: targetUser._id,
            initiatorUserId: currentUser?._id,
            callId,
            meetingId
          }
        }
      })
      // Clear callId after sending expired to prevent duplicate sends
      setCallId(null)
    }
  }, [currentUser, callUser])

  useEffect(() => {
    if (connectionStatus == 'calling') {
      const timeout = setTimeout(() => {
        sendExpired()
        setConnectionStatus('no-answer')
      }, MAX_CALLING_TIME_MS)

      return () => clearTimeout(timeout)
    }
  }, [open, connectionStatus, setConnectionStatus, sendExpired])

  useEffect(() => {
    if (open && connectionStatus === 'calling') {
      playCallingSound()
    } else {
      stopCallingSound()
    }
  }, [open, connectionStatus, playCallingSound, stopCallingSound])

  if (!targetUser) return null

  const handleCallAgain = async () => {
    await doCall(targetUser, meetingId, meetingLastCallTime)
  }


  const handleCancel = async () => {
    setConnectionStatus('disconnected')
    if (targetUser._id) {
      await sendExpired()
      await caller.cleanup()
    }
  }

  const showUserInfo = !meetingId || meetingLastCallTime

  return ( open &&
    <Dialog
      open={open}
      onClose={handleCancel}
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
        {tStatus(connectionStatus)}
      </DialogTitle>
      <DialogContent>
        {showUserInfo && <CallUserInfo user={targetUser} />}
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
      </DialogContent>
      <DialogActions className="border-t brighter-border" style={{ backgroundColor: 'transparent' }}>
        {(connectionStatus === 'no-answer' || connectionStatus === 'busy') &&
          <Button onClick={handleCallAgain} variant="contained" color="success" startIcon={<CallIcon sx={{ color: 'white' }} />}>
            {t('callback')}
          </Button>
        }
        <Button onClick={handleCancel} variant="contained" color="error">
          {t('cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  )
} 