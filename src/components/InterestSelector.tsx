'use client'

import React from 'react'
import { Button } from '@mui/material'
import { useTranslations } from 'next-intl'

interface InterestSelectorProps {
  value: string[]
  onChange: (interests: string[]) => void
  interestsPairs: string[][]
  interestsToMatch?: string[]
  label?: string
}

export default function InterestSelector({ value, onChange, interestsPairs, interestsToMatch, label }: InterestSelectorProps) {
  const tRoot = useTranslations()

  const isInterestVisible = (interest: string) => {
    if (!interestsToMatch || interestsToMatch.length === 0) return true
    return interestsToMatch.includes(interest)
  }

  const handleInterestClick = (interest: string) => {
    if (value.includes(interest)) {
      onChange(value.filter(i => i !== interest))
    } else {
      onChange([...value, interest])
    }
  }

  return (
    <fieldset>
      <legend className="font-medium mb-4">{label || tRoot('selectInterest')}</legend>
      
      <div className="grid grid-cols-2 gap-4">
        {interestsPairs.map((pair, index) => {
          const [leftInterest, rightInterest] = pair
          
          // Only show row if at least one column is visible
          const rowVisible = isInterestVisible(leftInterest) || isInterestVisible(rightInterest)
          if (!rowVisible) {
            return null
          }
          
          return (
            <React.Fragment key={`${leftInterest}-${rightInterest}-${index}`}>
              <Button
                fullWidth
                variant={value.includes(leftInterest) ? "contained" : "outlined"}
                onClick={() => handleInterestClick(leftInterest)}
                style={{ visibility: isInterestVisible(leftInterest) ? 'visible' : 'hidden' }}
              >
                {leftInterest}
              </Button>
              <Button
                fullWidth
                variant={value.includes(rightInterest) ? "contained" : "outlined"}
                onClick={() => handleInterestClick(rightInterest)}
                style={{ visibility: isInterestVisible(rightInterest) ? 'visible' : 'hidden' }}
              >
                {rightInterest}
              </Button>
            </React.Fragment>
          )
        })}
      </div>
    </fieldset>
  )
} 