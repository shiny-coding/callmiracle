import React from 'react'
import { Dialog, DialogTitle, DialogContent, IconButton, Divider, TextField, FormGroup, FormControlLabel, Checkbox } from '@mui/material'
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
  const [nameFilter, setNameFilter] = useState('')
  const [showMales, setShowMales] = useState(true)
  const [showFemales, setShowFemales] = useState(true)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle className="flex justify-between items-center">
        {t('searchUser')}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder={t('searchByName')}
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="mb-4"
          size="small"
        />
        <FormGroup className="mb-4">
          <div className="flex gap-4">
            <FormControlLabel
              control={
                <Checkbox
                  checked={showMales}
                  onChange={(e) => setShowMales(e.target.checked)}
                  size="small"
                />
              }
              label={t('Profile.male')}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showFemales}
                  onChange={(e) => setShowFemales(e.target.checked)}
                  size="small"
                />
              }
              label={t('Profile.female')}
            />
          </div>
        </FormGroup>
        <LanguageSelector
          value={selectedLanguages}
          onChange={setSelectedLanguages}
          label={t('filterByLanguages')}
        />
        <Divider className="mb-4" />
        <UserList 
          filterLanguages={selectedLanguages}
          nameFilter={nameFilter}
          showMales={showMales}
          showFemales={showFemales}
        />
      </DialogContent>
    </Dialog>
  )
} 