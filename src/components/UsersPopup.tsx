import React from 'react'
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import UserList from './UserList'

interface Props {
  open: boolean
  onClose: () => void
}

export default function UsersPopup({ open, onClose }: Props) {
  const t = useTranslations()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle className="flex justify-between items-center">
        {t('VideoChat.selectUser')}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <UserList />
      </DialogContent>
    </Dialog>
  )
} 