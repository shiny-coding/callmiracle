'use client'

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import MicIcon from '@mui/icons-material/Mic'
import { useTranslations } from 'next-intl'

interface PermissionDeniedDialogProps {
  open: boolean
  onClose: () => void
  onRetry: () => void
  isIOS: boolean
}

export default function PermissionDeniedDialog({
  open,
  onClose,
  onRetry,
  isIOS
}: PermissionDeniedDialogProps) {
  const t = useTranslations()

  const handleRetry = () => {
    if (isIOS) {
      // On iOS, we need to refresh the page to show permission prompt again
      window.location.reload()
    } else {
      // On Android/desktop, we can request directly
      onRetry()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
        {t('permissionsRequired')}
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, my: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VideocamIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="body2">{t('camera')}</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <MicIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="body2">{t('microphone')}</Typography>
          </Box>
        </Box>

        <Typography variant="body1" sx={{ mb: 2 }}>
          {t('permissionsExplanation')}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {t('permissionsNote')}
        </Typography>

        {isIOS && (
          <Typography variant="body2" color="warning.main" sx={{ mt: 2 }}>
            {t('iosPermissionNote')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 2 }}>
        <Button onClick={onClose} variant="outlined">
          {t('later')}
        </Button>
        <Button onClick={handleRetry} variant="contained" autoFocus>
          {isIOS ? t('refreshToAllow') : t('allowPermissions')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
