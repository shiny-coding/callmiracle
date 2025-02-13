import { Dialog, DialogTitle, DialogContent, IconButton, DialogActions, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import StatusSelector from './StatusSelector'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useStore } from '@/store/useStore'
import { useState, useEffect } from 'react'
import { Status } from '@/generated/graphql'

type Props = {
  open: boolean
  onClose: () => void
}

export default function StatusSettings({ open, onClose }: Props) {
  const t = useTranslations()
  const { updateUserData } = useUpdateUser()
  const { statuses, setStatuses } = useStore()
  const [tempStatuses, setTempStatuses] = useState<Status[]>(statuses)

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
    setStatuses(tempStatuses)
    await updateUserData()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleCancel}>
      <div className="flex justify-between items-center pr-2">
        <DialogTitle>{t('selectStatus')}</DialogTitle>
        <IconButton onClick={handleCancel} size="small">
          <CloseIcon />
        </IconButton>
      </div>
      <DialogContent className="flex flex-col gap-4 min-w-[300px]">
        <StatusSelector value={tempStatuses} onChange={setTempStatuses} />
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button 
          onClick={handleApply}
          variant="contained" 
          disabled={JSON.stringify(tempStatuses) === JSON.stringify(statuses)}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  )
} 