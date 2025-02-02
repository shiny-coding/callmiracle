import { Dialog, DialogTitle, DialogContent, Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import StatusSelector from './StatusSelector'

type Props = {
  open: boolean
  onClose: () => void
}

export default function StatusSettings({ open, onClose }: Props) {
  const t = useTranslations()

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t('selectStatus')}</DialogTitle>
      <DialogContent className="flex flex-col gap-4 min-w-[300px]">
        <StatusSelector />
        <Button onClick={onClose} variant="contained" color="primary">
          {t('VideoChat.common.close')}
        </Button>
      </DialogContent>
    </Dialog>
  )
} 