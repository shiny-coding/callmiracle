import { Dialog, DialogTitle, DialogContent, IconButton, DialogActions, Button, FormGroup, FormControlLabel, Checkbox, Slider, Typography, Divider } from '@mui/material'
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
  const { 
    statuses = [], 
    allowedMales = true, 
    allowedFemales = true, 
    allowedMinAge = 10, 
    allowedMaxAge = 100 
  } = user || {}
  const [tempStatuses, setTempStatuses] = useState<Status[]>(statuses)
  const [tempAllowedMales, setTempAllowedMales] = useState(allowedMales)
  const [tempAllowedFemales, setTempAllowedFemales] = useState(allowedFemales)
  const [tempAgeRange, setTempAgeRange] = useState<[number, number]>([allowedMinAge, allowedMaxAge])
  const { updateUserData } = useUpdateUser()

  const handleMalesChange = (checked: boolean) => {
    if (!checked && !tempAllowedFemales) {
      setTempAllowedFemales(true)
    }
    setTempAllowedMales(checked)
  }
  
  const handleFemalesChange = (checked: boolean) => {
    if (!checked && !tempAllowedMales) {
      setTempAllowedMales(true)
    }
    setTempAllowedFemales(checked)
  }

  useEffect(() => {
    if (open) {
      setTempStatuses(statuses)
      setTempAllowedMales(allowedMales)
      setTempAllowedFemales(allowedFemales)
      setTempAgeRange([allowedMinAge, allowedMaxAge])
    }
  }, [open, statuses, allowedMales, allowedFemales, allowedMinAge, allowedMaxAge])

  const handleCancel = () => {
    setTempStatuses(statuses)
    setTempAllowedMales(allowedMales)
    setTempAllowedFemales(allowedFemales)
    setTempAgeRange([allowedMinAge, allowedMaxAge])
    onClose()
  }

  const handleApply = async () => {
    setUser({
      ...user!,
      statuses: tempStatuses,
      allowedMales: tempAllowedMales,
      allowedFemales: tempAllowedFemales,
      allowedMinAge: tempAgeRange[0],
      allowedMaxAge: tempAgeRange[1]
    })
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
      <DialogContent className="flex flex-col gap-4">
        <StatusSelector value={tempStatuses} onChange={setTempStatuses} />
        
        <Divider className="my-4" />
        
        <Typography variant="subtitle1" className="mt-4">
          {t('preferences')}
        </Typography>
        
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={tempAllowedMales}
                onChange={(e) => handleMalesChange(e.target.checked)}
              />
            }
            label={t('allowMales')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={tempAllowedFemales}
                onChange={(e) => handleFemalesChange(e.target.checked)}
              />
            }
            label={t('allowFemales')}
          />
        </FormGroup>
        
        <Typography>
          {t('ageRange')}: {tempAgeRange[0]} - {tempAgeRange[1]}
        </Typography>
        <Slider
          value={tempAgeRange}
          onChange={(_, newValue) => setTempAgeRange(newValue as [number, number])}
          min={10}
          max={100}
          valueLabelDisplay="auto"
        />
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        <Button onClick={handleCancel}>
          {t('cancel')}
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={
            JSON.stringify(tempStatuses) === JSON.stringify(statuses) &&
            tempAllowedMales === allowedMales &&
            tempAllowedFemales === allowedFemales &&
            tempAgeRange[0] === allowedMinAge &&
            tempAgeRange[1] === allowedMaxAge
          }
        >
          {t('apply')}
        </Button>
      </DialogActions>
    </Dialog>
  )
} 