import { Dialog, DialogTitle, DialogContent, IconButton, DialogActions, Button, FormGroup, FormControlLabel, Checkbox } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useStore } from '@/store/useStore'
import { useState, useEffect } from 'react'
import { Status } from '@/generated/graphql'
import StatusSelector from './StatusSelector'

type Props = {
  open: boolean
  onClose: () => void
}

export default function StatusSettings({ open, onClose }: Props) {
  const t = useTranslations()
  const tStatus = useTranslations('Status')
  const { user, setUser } = useStore()
  const { statuses = [] } = user || {}
  const [tempStatuses, setTempStatuses] = useState<Status[]>(statuses)
  const { updateUserData } = useUpdateUser()

  useEffect(() => {
    if (open) {
      setTempStatuses(statuses)
    }
  }, [open, statuses])

  const handleCancel = () => {
    setTempStatuses(statuses)
    onClose()
  }

  const handleApply = async () => {
    setUser({ ...user!, statuses: tempStatuses })
    await updateUserData()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle className="flex justify-between items-center">
        {t('selectStatus')}
        <IconButton onClick={handleCancel} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <StatusSelector value={tempStatuses} onChange={setTempStatuses} />
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        <Button onClick={handleCancel}>
          {t('cancel')}
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={JSON.stringify(tempStatuses) === JSON.stringify(statuses)}
        >
          {t('apply')}
        </Button>
      </DialogActions>
    </Dialog>
  )
} 