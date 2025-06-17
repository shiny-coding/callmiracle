'use client'

import React from 'react'
import { Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Group } from '@/generated/graphql'
import { getMatchingInterest, getAllInterests } from '@/utils/interests'

interface InterestSelectorProps {
  value: string[]
  onChange: (interests: string[]) => void
  interestsToMatch?: string[]
  label?: string
  group?: Group
  groups?: Group[]
}

export default function InterestSelector({ value, onChange, interestsToMatch, label, group, groups }: InterestSelectorProps) {
  const t = useTranslations('Interest')
  const tRoot = useTranslations()

  // Determine which groups to use for interest pairs
  const groupsToUse = groups || (group ? [group] : [])
  
  // Collect all unique interest pairs from all groups
  const allInterestsPairs: string[][] = []
  if (groupsToUse.length > 0) {
    groupsToUse.forEach(g => {
      if (g.interestsPairs && g.interestsPairs.length > 0) {
        g.interestsPairs.forEach(pair => {
          // Only add if this exact pair doesn't already exist
          const pairExists = allInterestsPairs.some(existingPair => 
            existingPair[0] === pair[0] && existingPair[1] === pair[1]
          )
          if (!pairExists) {
            allInterestsPairs.push(pair)
          }
        })
      }
    })
  }

  const interestsPairs = allInterestsPairs.length > 0 ? allInterestsPairs : null
  const allInterests = getAllInterests()

  const isInterestVisible = (interest: string) =>
    !interestsToMatch ||
    interestsToMatch.some(match => getMatchingInterest(interest) === match)

  const isInterestDisabled = (interest: string) =>
    interestsToMatch &&
    interestsToMatch.includes(interest) &&
    interest !== getMatchingInterest(interest)

  const toggleInterest = (interest: string) => {
    if (isInterestDisabled(interest)) return
    onChange(
      value.includes(interest)
        ? value.filter(i => i !== interest)
        : [...value, interest]
    )
  }

  return (
    <fieldset>
      <legend className="font-medium mb-4">{label || tRoot('selectInterest')}</legend>
      
      {interestsPairs ? (
        // Show group-specific pairs
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
                  onClick={() => toggleInterest(leftInterest)}
                  className="h-full"
                  disabled={isInterestDisabled(leftInterest)}
                >
                  {t(leftInterest)}
                </Button>
                <Button
                  fullWidth
                  variant={value.includes(rightInterest) ? "contained" : "outlined"}
                  onClick={() => toggleInterest(rightInterest)}
                  className="h-full"
                  disabled={isInterestDisabled(rightInterest)}
                >
                  {t(rightInterest)}
                </Button>
              </React.Fragment>
            )
          })}
        </div>
      ) : (
        // Show all interests individually when no group pairs are available
        <div className="grid grid-cols-2 gap-2">
          {allInterests.filter(isInterestVisible).map(interest => (
            <Button
              key={interest}
              fullWidth
              variant={value.includes(interest) ? "contained" : "outlined"}
              onClick={() => toggleInterest(interest)}
              className="h-full"
              disabled={isInterestDisabled(interest)}
            >
              {t(interest)}
            </Button>
          ))}
        </div>
      )}
    </fieldset>
  )
} 