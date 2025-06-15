'use client'

import React from 'react'
import { Button, IconButton, TextField, Select, MenuItem, FormControl, InputLabel } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslations } from 'next-intl'

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          {label || t('interestsDescriptions', { defaultValue: 'Interest Descriptions' })}
        </h3>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddDescription}
          variant="outlined"
          size="small"
          className="text-blue-400 border-blue-400"
          disabled={availableForNew.length === 0}
        >
          {t('addDescription', { defaultValue: 'Add Description' })}
        </Button>
      </div>
      
      <div className="text-sm text-gray-400 mb-4">
        {availableForNew.length === 0 && interestsPairs.length > 0
          ? t('allInterestsHaveDescriptions', { defaultValue: 'All interests already have descriptions.' })
          : availableForNew.length === 0
          ? t('addInterestPairsFirst', { defaultValue: 'Add interest pairs first to enable descriptions.' })
          : t('interestsDescriptionsDescription', { defaultValue: 'Add optional descriptions for interests to provide more context to group members.' })
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
                  {t('selectInterest', { defaultValue: 'Select interest' })}
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
            
            <div className="text-sm text-gray-300 mb-2">
              {t('describingInterest', { defaultValue: 'Describing' })}: <strong>{item.interest || t('emptyInterest', { defaultValue: '(empty)' })}</strong>
            </div>
            
            <TextField
              value={item.description}
              onChange={(e) => handleDescriptionChange(index, e.target.value)}
              placeholder={t('enterDescription', { defaultValue: 'Enter description...' })}
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