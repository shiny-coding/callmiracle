import React from 'react'
import { Dialog, DialogTitle, DialogContent, IconButton, Divider } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import UserList from './UserList'
import { useState } from 'react'
import LanguageSelector from './LanguageSelector'

interface Props {
  open: boolean
  onClose: () => void
}

export default function UsersPopup({ open, onClose }: Props) {
  const t = useTranslations()
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])

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
        <LanguageSelector
          value={selectedLanguages}
          onChange={setSelectedLanguages}
          label={t('filterByLanguages')}
        />
        <Divider className="mb-4" />
        <UserList filterLanguages={selectedLanguages} />
      </DialogContent>
    </Dialog>
  )
} 