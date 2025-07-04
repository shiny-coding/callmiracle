import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { useRouter } from 'next/navigation'

interface ProfileIncompleteDialogProps {
  open: boolean
  onClose: () => void
}

export default function ProfileIncompleteDialog({ open, onClose }: ProfileIncompleteDialogProps) {
  const t = useTranslations()
  const { currentUser } = useStore((state) => ({
    currentUser: state.currentUser
  }))
  const router = useRouter()

  const handleOpenProfileSettings = () => {
    router.push( '/profile' )
    onClose()
  }
  
  // Determine which fields are missing
  const missingFields = []
  if (!currentUser?.languages || currentUser.languages.length === 0) {
    missingFields.push('languages')
  }
  if (!currentUser?.name || currentUser.name.trim() === '') {
    missingFields.push('name')
  }
  if (!currentUser?.sex || currentUser.sex.trim() === '') {
    missingFields.push('gender')
  }
  if (!currentUser?.birthYear) {
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
    </>
  )
} 