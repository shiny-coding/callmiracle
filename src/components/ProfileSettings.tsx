import { Dialog, DialogTitle, DialogContent, TextField, Button } from '@mui/material'
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
      <DialogTitle>{t('profile.settings')}</DialogTitle>
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
        <Button onClick={onClose} variant="contained" color="primary">
          {t('common.close')}
        </Button>
      </DialogContent>
    </Dialog>
  )
} 