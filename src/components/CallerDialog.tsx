import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material'
import CallIcon from '@mui/icons-material/Call'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import SettingsIcon from '@mui/icons-material/Settings'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import CallUserInfo from './CallUserInfo'
import { syncStore, useStore, vanillaStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { usePlaySound } from '@/hooks/usePlaySound'
import { MAX_CALLING_TIME_MS } from '@/config/constants'
import clientLogger from '@/utils/clientLogger'

export default function CallerDialog() {
  const t = useTranslations()
  const { connectionStatus, setConnectionStatus, targetUser, meetingId, meetingLastCallTime, currentUser, localAudioEnabled, localVideoEnabled, setLocalAudioEnabled, setLocalVideoEnabled, pendingMissedCall, setDeviceSettingsOpen } = useStore( (state: any) => ({
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
    pendingMissedCall: state.pendingMissedCall,
    setDeviceSettingsOpen: state.setDeviceSettingsOpen
  }))
  const tStatus = useTranslations('ConnectionStatus')
  const { doCall, callUser, caller } = useWebRTCContext()
  // Don't show CallerDialog if MissedCallDialog is handling a notification click
  const open = !!targetUser && connectionStatus && ['calling', 'connecting', 'busy', 'no-answer'].includes(connectionStatus) && !pendingMissedCall
  const isCalling = connectionStatus === 'calling'
  const { play: playCallingSound, stop: stopCallingSound } = usePlaySound('/sounds/sfx-calling.mp3', { loop: true, resumeOnVisibilityChange: true })
  const handleDeviceSettings = () => setDeviceSettingsOpen(true)

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
    clientLogger.info('Calls', 'Sound effect triggered', {
      open,
      connectionStatus,
      shouldPlay: open && connectionStatus === 'calling'
    })
    if (open && connectionStatus === 'calling') {
      clientLogger.info('Calls', 'Calling playCallingSound()')
      playCallingSound()
    } else {
      clientLogger.info('Calls', 'Calling stopCallingSound()')
      stopCallingSound()
    }
  }, [open, connectionStatus, playCallingSound, stopCallingSound])

  // Show user info: always for non-meeting calls, or for meeting calls after first call
  // For first meeting calls, peer info stays hidden to preserve anonymity
  const showUserInfo = !meetingId || meetingLastCallTime

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
