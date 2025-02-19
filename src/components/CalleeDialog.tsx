import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import UserInfoDisplay from './UserInfoDisplay'
import { useStore } from '@/store/useStore'
import { useWebRTCCallee } from '@/hooks/webrtc/useWebRTCCallee'

interface CalleeDialogProps {
  calee: ReturnType<typeof useWebRTCCallee>
}

export default function CalleeDialog({ calee }: CalleeDialogProps) {
  const t = useTranslations('VideoChat')
  const { connectionStatus } = useStore()
  const tStatus = useTranslations('ConnectionStatus')

  const isReconnecting = connectionStatus === 'reconnecting' || connectionStatus === 'need-reconnect'
  const open = isReconnecting || !!calee.incomingRequest
  const user = calee.incomingRequest?.from || null
  const onAccept = calee.handleAcceptCall
  const onReject = calee.handleRejectCall

  if (!user) return null

  const isConnecting = connectionStatus === 'connecting'
  const onCancelReconnect = calee.hangup

  return (
    <Dialog 
      open={open}
      onClose={onReject}
      PaperProps={{
        className: 'bg-gray-900 text-white'
      }}
    >
      <DialogTitle>
        {tStatus(connectionStatus)}
      </DialogTitle>
      <DialogContent>
        <UserInfoDisplay user={user} />
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        {!isReconnecting && (
        <Button onClick={onReject} variant="contained" color="error">
          {t('reject')}
          </Button>
        )}
        {!isReconnecting && !isConnecting && (
          <Button onClick={() => onAccept(false)} variant="contained" color="success">
            {t('accept')}
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