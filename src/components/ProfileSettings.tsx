import { Dialog, DialogTitle, DialogContent, TextField, Button, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import { useStore } from '@/store/useStore'
import LanguageSelector from './LanguageSelector'

type Props = {
  open: boolean
  onClose: () => void
}

export default function ProfileSettings({ open, onClose }: Props) {
  const t = useTranslations('VideoChat')
  const { name, setName } = useStore()

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="flex justify-between items-center pr-2">
        <DialogTitle>{t('profile.settings')}</DialogTitle>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </div>
      <DialogContent className="flex flex-col gap-4 min-w-[300px]">
        <TextField
          label={t('profile.name')}
          value={name}
          onChange={handleNameChange}
          fullWidth
          variant="outlined"
          size="small"
        />
        <LanguageSelector />
      </DialogContent>
    </Dialog>
  )
} 