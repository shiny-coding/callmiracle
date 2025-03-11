import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import UserSettingsDialog from './UserSettingsDialog'
import { useStore } from '@/store/useStore'

interface ProfileIncompleteDialogProps {
  open: boolean
  onClose: () => void
}

export default function ProfileIncompleteDialog({ open, onClose }: ProfileIncompleteDialogProps) {
  const t = useTranslations()
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false)
  const { user } = useStore()
  
  const handleOpenProfileSettings = () => {
    setProfileSettingsOpen(true)
    onClose()
  }
  
  // Determine which fields are missing
  const missingFields = []
  if (!user?.name || user.name.trim() === '') {
    missingFields.push('name')
  }
  if (!user?.sex || user.sex.trim() === '') {
    missingFields.push('gender')
  }
  if (!user?.birthYear) {
    missingFields.push('age')
  }
  
  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('incompleteProfile')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('pleaseCompleteProfileFirst')}
          </Typography>
          <Typography className="mt-4">
            {t('missing')}:
            {missingFields.map((field, index) => (
              <span key={field} className="text-green-500 font-medium">
                {index > 0 ? ', ' : ' '}
                {field}
              </span>
            ))}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleOpenProfileSettings}
            variant="contained"
            color="primary"
          >
            {t('completeProfile')}
          </Button>
        </DialogActions>
      </Dialog>
      
      <UserSettingsDialog
        open={profileSettingsOpen}
        onClose={() => setProfileSettingsOpen(false)}
      />
    </>
  )
} 