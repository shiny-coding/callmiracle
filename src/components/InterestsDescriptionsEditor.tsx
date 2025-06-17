'use client'

import React from 'react'
import { Button, IconButton, TextField, Select, MenuItem, FormControl, InputLabel } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslations } from 'next-intl'
import { Typography } from '@mui/material'

interface InterestDescription {
  interest: string
  description: string
}

interface InterestsDescriptionsEditorProps {
  value: InterestDescription[]
  onChange: (descriptions: InterestDescription[]) => void
  interestsPairs: string[][]
  label?: string
}

export default function InterestsDescriptionsEditor({ value, onChange, interestsPairs, label }: InterestsDescriptionsEditorProps) {
  const t = useTranslations()

  // Get all unique interests from pairs, avoiding duplicates
  const availableInterests = React.useMemo(() => {
    const uniqueInterests = new Set<string>()
    interestsPairs.forEach(pair => {
      if (pair[0]) uniqueInterests.add(pair[0])
      if (pair[1]) uniqueInterests.add(pair[1])
    })
    return Array.from(uniqueInterests).sort()
  }, [interestsPairs])

  // Filter out interests that already have descriptions
  const availableForNew = availableInterests.filter(interest => 
    !value.some(desc => desc.interest === interest)
  )

  const handleAddDescription = () => {
    if (availableForNew.length > 0) {
      const firstAvailable = availableForNew[0]
      onChange([...value, { 
        interest: firstAvailable, 
        description: '' 
      }])
    }
  }

  const handleRemoveDescription = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleInterestChange = (index: number, newInterestName: string) => {
    const newDescriptions = value.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          interest: newInterestName
        }
      }
      return item
    })
    onChange(newDescriptions)
  }

  const handleDescriptionChange = (index: number, newDescription: string) => {
    const newDescriptions = value.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          description: newDescription
        }
      }
      return item
    })
    onChange(newDescriptions)
  }

  const canAddDescription = () => {
    return availableForNew.length > 0
  }

  return (
    <div className="space-y-4">
      <Typography variant="h6" component="h2" className="mb-4">
        {label || t('interestsDescriptions')}
      </Typography>
      <div className="flex justify-between items-center mb-4">
        <Button
          variant="outlined"
          onClick={handleAddDescription}
          disabled={!canAddDescription()}
          className="text-blue-400 border-blue-400"
        >
          {t('addDescription')}
        </Button>
      </div>
      
      <div className="text-sm text-gray-400 mb-4">
        {!canAddDescription()
          ? t('allInterestsHaveDescriptions')
          : availableInterests.length === 0
          ? t('addInterestPairsFirst')
          : t('interestsDescriptionsDescription')
        }
      </div>

      {value.map((item, index) => {
        // Find available options for this description (current selection + unused interests)
        const availableForThis = availableInterests.filter(interest => 
          interest === item.interest ||
          !value.some(desc => desc.interest === interest)
        )
        
        return (
          <div key={index} className="flex flex-col gap-3 p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2">
              <FormControl className="flex-1">
                <InputLabel className="text-gray-300">
                  {t('selectInterest')}
                </InputLabel>
                <Select
                  value={item.interest}
                  onChange={(e) => handleInterestChange(index, e.target.value)}
                  className="text-white"
                >
                  {availableForThis.map(interest => (
                    <MenuItem 
                      key={interest} 
                      value={interest}
                    >
                      {interest}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <IconButton
                onClick={() => handleRemoveDescription(index)}
                size="small"
                className="text-red-400"
              >
                <DeleteIcon />
              </IconButton>
            </div>
            
            <div className="text-sm text-gray-600 mb-2">
              {t('describingInterest')}: <strong>{item.interest || t('emptyInterest')}</strong>
            </div>
            
            <TextField
              value={item.description}
              onChange={(e) => handleDescriptionChange(index, e.target.value)}
              placeholder={t('enterDescription')}
              variant="outlined"
              size="small"
              multiline
              rows={3}
              InputProps={{
                className: 'text-white'
              }}
              InputLabelProps={{
                className: 'text-gray-300'
              }}
              className="w-full"
            />
          </div>
        )
      })}
    </div>
  )
} 