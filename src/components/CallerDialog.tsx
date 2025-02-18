import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import UserInfoDisplay from './UserInfoDisplay'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { getUserId } from '@/lib/userId'

const MAX_CALLING_TIME_MS = 10000

interface CallerDialogProps {
  user: User | null
}

export default function CallerDialog({ user }: CallerDialogProps) {
  const t = useTranslations()
  const { connectionStatus, setConnectionStatus, targetUserId } = useStore()
  const tStatus = useTranslations('ConnectionStatus')
  const { doCall, connectWithUser, hangup } = useWebRTCContext()
  const open = !!user && connectionStatus && ['calling', 'connecting', 'busy', 'no-answer'].includes(connectionStatus)

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

  if (!user) return null

  const handleCallAgain = async () => {
    await doCall(user.userId)
  }

  const sendExpired = async () => {
    const { targetUserId, callId } = useStore.getState()
    if (callId) {
      console.log('Sending expired', callId)
      await connectWithUser({
        variables: {
          input: {
            type: 'expired',
            targetUserId,
            initiatorUserId: getUserId(),
            callId
          }
        }
      })
    }
  }

  const handleCancel = async () => {
    setConnectionStatus('disconnected')
    if (targetUserId) {
      await sendExpired()
      await hangup()
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
        <UserInfoDisplay user={user} />
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        {connectionStatus === 'no-answer' &&
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