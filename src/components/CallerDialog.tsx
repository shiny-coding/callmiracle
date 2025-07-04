import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import UserCard from './UserCard'
import { syncStore, useStore, vanillaStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { usePlaySound } from '@/hooks/usePlaySound'

const MAX_CALLING_TIME_MS = 10000

export default function CallerDialog() {
  const t = useTranslations()
  const { connectionStatus, setConnectionStatus, targetUser, meetingId, meetingLastCallTime, currentUser } = useStore( (state: any) => ({
    connectionStatus: state.connectionStatus,
    setConnectionStatus: state.setConnectionStatus,
    targetUser: state.targetUser,
    meetingId: state.meetingId,
    meetingLastCallTime: state.meetingLastCallTime,
    currentUser: state.currentUser
  }))
  const tStatus = useTranslations('ConnectionStatus')
  const { doCall, callUser, caller } = useWebRTCContext()
  const open = !!targetUser && connectionStatus && ['calling', 'connecting', 'busy', 'no-answer', 'reconnecting', 'need-reconnect'].includes(connectionStatus)
  const { play: playCallingSound, stop: stopCallingSound } = usePlaySound('/sounds/sfx-calling.mp3', { loop: true })

  const sendExpired = useCallback(async () => {
    const { targetUser, callId } = syncStore()
    if (callId && targetUser) {
      console.log('Sending expired', callId)
      await callUser({
        variables: {
          input: {
            type: 'expired',
            targetUserId: targetUser._id,
            initiatorUserId: currentUser?._id,
            callId
          }
        }
      })
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
    await doCall(targetUser, false, meetingId, meetingLastCallTime)
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
        className: 'bg-gray-900 text-white min-w-[300px]'
      }}
    >
      <DialogTitle className="flex justify-between items-center">
        {tStatus(connectionStatus)}
      </DialogTitle>
      <DialogContent>
        {showUserInfo && <UserCard user={targetUser} />}
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        {(connectionStatus === 'no-answer' || connectionStatus === 'busy') &&
          <Button onClick={handleCallAgain} variant="contained" color="primary">
            {t('callAgain')}
          </Button>
        }
        <Button onClick={handleCancel} variant="contained" color="error">
          {t('cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  )
} 