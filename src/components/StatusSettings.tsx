import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
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
      <div className="flex justify-between items-center pr-2">
        <DialogTitle>{t('selectStatus')}</DialogTitle>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </div>
      <DialogContent className="flex flex-col gap-4 min-w-[300px]">
        <StatusSelector />
      </DialogContent>
    </Dialog>
  )
} 