'use client'

import React from 'react'
import { Button, IconButton, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslations } from 'next-intl'

interface InterestsPairsEditorProps {
  value: string[][]
  onChange: (pairs: string[][]) => void
  label?: string
}

export default function InterestsPairsEditor({ value, onChange, label }: InterestsPairsEditorProps) {
  const t = useTranslations()

  const handleAddPair = () => {
    onChange([...value, ['', '']])
  }

  const handleRemovePair = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handlePairChange = (pairIndex: number, interestIndex: number, newValue: string) => {
    const newPairs = value.map((pair, i) => {
      if (i === pairIndex) {
        const newPair = [...pair]
        newPair[interestIndex] = newValue
        return newPair
      }
      return [...pair]
    })
    onChange(newPairs)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          {label || t('interestsPairs', { defaultValue: 'Interests Pairs' })}
        </h3>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddPair}
          variant="outlined"
          size="small"
          className="text-blue-400 border-blue-400"
        >
          {t('addPair', { defaultValue: 'Add Pair' })}
        </Button>
      </div>
      
      <div className="text-sm text-gray-400 mb-4">
        {t('interestsPairsDescription', { defaultValue: 'Define interest pairs for this group. Each pair represents two interests that can be matched together in meetings.' })}
      </div>

      {value.map((pair, pairIndex) => (
        <div key={pairIndex} className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg">
          <TextField
            value={pair[0] || ''}
            onChange={(e) => handlePairChange(pairIndex, 0, e.target.value)}
            placeholder={t('selectFirstInterest', { defaultValue: 'Select first interest' })}
            variant="outlined"
            size="small"
            InputProps={{
              className: 'text-white'
            }}
            InputLabelProps={{
              className: 'text-gray-300'
            }}
            className="flex-1"
          />
          
          <span className="text-gray-400 px-2">↔</span>
          
          <TextField
            value={pair[1] || ''}
            onChange={(e) => handlePairChange(pairIndex, 1, e.target.value)}
            placeholder={t('selectSecondInterest', { defaultValue: 'Select second interest' })}
            variant="outlined"
            size="small"
            InputProps={{
              className: 'text-white'
            }}
            InputLabelProps={{
              className: 'text-gray-300'
            }}
            className="flex-1"
          />
          
          <IconButton
            onClick={() => handleRemovePair(pairIndex)}
            size="small"
            className="text-red-400"
          >
            <DeleteIcon />
          </IconButton>
        </div>
      ))}
    </div>
  )
} 