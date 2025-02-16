import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import UserInfoDisplay from './UserInfoDisplay'

const MAX_CALLING_TIME_MS = 10000

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
    }, MAX_CALLING_TIME_MS)

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