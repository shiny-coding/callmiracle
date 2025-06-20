'use client'

import { FormControl, Select, MenuItem, Typography, FormGroup } from '@mui/material'
import { SelectChangeEvent } from '@mui/material/Select'
import { useTranslations } from 'next-intl'
import { Group } from '@/generated/graphql'

interface SingleGroupSelectorProps {
  value: string
  onChange: (groupId: string) => void
  label?: string
  availableGroups: Group[]
}

export default function SingleGroupSelector({ value, onChange, label, availableGroups }: SingleGroupSelectorProps) {
  const t = useTranslations()

  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value)
  }

  return (
    <FormGroup>
      {label && (
        <Typography variant="subtitle1" className="mb-2">
          {label}
        </Typography>
      )}
      <FormControl fullWidth>
        <Select
          value={value}
          onChange={handleChange}
          displayEmpty
          variant="outlined"
        >
          <MenuItem value="">
            <em>{t('selectGroup')}</em>
          </MenuItem>
          {availableGroups.map((group) => (
            <MenuItem key={group._id} value={group._id}>
              {group.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </FormGroup>
  )
} 