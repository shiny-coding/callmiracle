import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import UserInfoDisplay from './UserInfoDisplay'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { getUserId } from '@/lib/userId'

const MAX_CALLING_TIME_MS = 10000

export default function CallerDialog() {
  const t = useTranslations()
  const { connectionStatus, setConnectionStatus, targetUser } = useStore()
  const tStatus = useTranslations('ConnectionStatus')
  const { doCall, connectWithUser, caller } = useWebRTCContext()
  const open = !!targetUser && connectionStatus && ['calling', 'connecting', 'busy', 'no-answer', 'reconnecting', 'need-reconnect'].includes(connectionStatus)

  useEffect(() => {
    if (!open) return
    
    const timeout = setTimeout(() => {
      if (connectionStatus === 'calling') {
        sendExpired()
        setConnectionStatus('no-answer')
      }
    }, MAX_CALLING_TIME_MS)

    return () => clearTimeout(timeout)
  }, [open, connectionStatus, setConnectionStatus])

  if (!targetUser) return null

  const handleCallAgain = async () => {
    await doCall(targetUser)
  }

  const sendExpired = async () => {
    const { targetUser, callId } = useStore.getState()
    if (callId && targetUser) {
      console.log('Sending expired', callId)
      await connectWithUser({
        variables: {
          input: {
            type: 'expired',
            targetUserId: targetUser.userId,
            initiatorUserId: getUserId(),
            callId
          }
        }
      })
    }
  }

  const handleCancel = async () => {
    setConnectionStatus('disconnected')
    if (targetUser.userId) {
      await sendExpired()
      await caller.cleanup()
    }
  }

  return ( open &&
    <Dialog 
      open={open}
      onClose={handleCancel}
      PaperProps={{
        className: 'bg-gray-900 text-white'
      }}
    >
      <DialogTitle>{tStatus(connectionStatus)}</DialogTitle>
      <DialogContent>
        <UserInfoDisplay user={targetUser} />
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