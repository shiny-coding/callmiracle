import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, IconButton, Badge } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import NotificationsList from './NotificationsList'
import { useNotifications } from '@/contexts/NotificationsContext'

interface NotificationsPopupProps {
  open: boolean
  onClose: () => void
}

export default function NotificationsPopup({ open, onClose }: NotificationsPopupProps) {
  const t = useTranslations()
  const { hasUnseenNotifications } = useNotifications()

  return (
    <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          className: 'bg-gray-900 text-white'
        }}
      >
        <DialogTitle className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {hasUnseenNotifications && <Badge color="primary" variant="dot" />}
            {t('notifications')}
          </div>
          <IconButton onClick={onClose} size="small" className="text-white">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <NotificationsList onClose={onClose} />
        </DialogContent>
      </Dialog>
  )
} 