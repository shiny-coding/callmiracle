import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import UserInfoDisplay from './UserInfoDisplay'

interface CalleeDialogProps {
  open: boolean
  user: User | null
  onAccept: () => void
  onReject: () => void
}

export default function CalleeDialog({ open, user, onAccept, onReject }: CalleeDialogProps) {
  const t = useTranslations('VideoChat')

  if (!user) return null

  return (
    <Dialog 
      open={open}
      onClose={onReject}
      PaperProps={{
        className: 'bg-gray-900 text-white'
      }}
    >
      <DialogTitle>
        {t('incomingCall')} {user.name}
      </DialogTitle>
      <DialogContent>
        <UserInfoDisplay user={user} />
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        <Button onClick={onReject} variant="contained" color="error">
          {t('reject')}
        </Button>
        <Button onClick={onAccept} variant="contained" color="success">
          {t('accept')}
        </Button>
      </DialogActions>
    </Dialog>
  )
} 