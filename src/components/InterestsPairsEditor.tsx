'use client'

import React from 'react'
import { Button, IconButton, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { useTranslations } from 'next-intl'
import { Typography } from '@mui/material'

interface InterestsPairsEditorProps {
  value: string[][]
  onChange: (pairs: string[][]) => void
  onReorder?: (newPairs: string[][]) => void
  label?: string
}

export default function InterestsPairsEditor({ value, onChange, onReorder, label }: InterestsPairsEditorProps) {
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

  const handleMovePair = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= value.length) return

    const newPairs = [...value]
    const temp = newPairs[index]
    newPairs[index] = newPairs[newIndex]
    newPairs[newIndex] = temp

    onChange(newPairs)
    
    // Notify parent about the reordering so it can update descriptions
    if (onReorder) {
      onReorder(newPairs)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          {label || t('interestsPairs')}
        </h3>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddPair}
          variant="outlined"
          size="small"
          className="text-blue-400 border-blue-400"
        >
          {t('addPair')}
        </Button>
      </div>
      
      <Typography variant="body2" className="mb-6 text-gray-400">
        {t('interestsPairsDescription')}
      </Typography>

      {value.map((pair, pairIndex) => (
        <div key={pairIndex} className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg flex-wrap">
          {/* Move up/down buttons */}
          <div className="flex flex-col gap-1">
            <IconButton
              onClick={() => handleMovePair(pairIndex, 'up')}
              disabled={pairIndex === 0}
              size="small"
              className={`${pairIndex === 0 ? 'text-gray-600' : 'text-blue-400'}`}
            >
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={() => handleMovePair(pairIndex, 'down')}
              disabled={pairIndex === value.length - 1}
              size="small"
              className={`${pairIndex === value.length - 1 ? 'text-gray-600' : 'text-blue-400'}`}
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          </div>

          <TextField
            value={pair[0] || ''}
            onChange={(e) => handlePairChange(pairIndex, 0, e.target.value)}
            placeholder={t('enterFirstInterest')}
            variant="outlined"
            size="small"
            InputProps={{
              className: 'text-white'
            }}
            InputLabelProps={{
              className: 'text-gray-300'
            }}
            className="flex-1 !min-w-[200px]"
          />
          
          <span className="text-gray-400 px-2">↔</span>
          
          <TextField
            value={pair[1] || ''}
            onChange={(e) => handlePairChange(pairIndex, 1, e.target.value)}
            placeholder={t('enterSecondInterest')}
            variant="outlined"
            size="small"
            InputProps={{
              className: 'text-white'
            }}
            InputLabelProps={{
              className: 'text-gray-300'
            }}
            className="flex-1 !min-w-[200px]"
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