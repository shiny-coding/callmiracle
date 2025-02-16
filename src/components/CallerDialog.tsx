import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import { CONNECTION_TIMEOUT_MS } from '@/hooks/webrtc/useWebRTCCommon'
import UserInfoDisplay from './UserInfoDisplay'

interface CallerDialogProps {
  open: boolean
  user: User | null
  onCancel: () => void
}

export default function CallerDialog({ open, user, onCancel }: CallerDialogProps) {
  const t = useTranslations()

  useEffect(() => {
    if (!open) return
    
    const timeout = setTimeout(() => {
      onCancel()
    }, CONNECTION_TIMEOUT_MS)

    return () => clearTimeout(timeout)
  }, [open, onCancel])

  if (!user) return null

  return (
    <Dialog 
      open={open}
      onClose={onCancel}
      PaperProps={{
        className: 'bg-gray-900 text-white'
      }}
    >
      <DialogTitle>{t('calling')}</DialogTitle>
      <DialogContent>
        <UserInfoDisplay user={user} />
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        <Button onClick={onCancel} variant="contained" color="error">
          {t('cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  )
} 