'use client'

import React from 'react'
import { Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Interest } from '@/generated/graphql'
import { getMatchingInterest } from '@/utils/meetingUtils'

interface InterestSelectorProps {
  value: Interest[]
  onChange: (interests: Interest[]) => void
}

// Define the status relationships map
export const interestRelationships = new Map<Interest, Interest>([
  [Interest.Chat, getMatchingInterest(Interest.Chat)],
  [Interest.MeetNewPeople, getMatchingInterest(Interest.MeetNewPeople)],
  [Interest.NeedEmotionalSupport, getMatchingInterest(Interest.NeedEmotionalSupport)],
  [Interest.NeedMentalSupport, getMatchingInterest(Interest.NeedMentalSupport)],
  [Interest.NeedSpeakingOut, getMatchingInterest(Interest.NeedSpeakingOut)],
  [Interest.PrayTogether, getMatchingInterest(Interest.PrayTogether)],
  [Interest.MeditateTogether, getMatchingInterest(Interest.MeditateTogether)],
])

export default function InterestSelector({ value, onChange }: InterestSelectorProps) {
  const t = useTranslations('Interest')
  const tRoot = useTranslations()

  // Split interests into left and right columns
  const leftColumnInterests = Array.from(interestRelationships.keys())
  const rightColumnInterests = Array.from(new Set(interestRelationships.values()))

  const toggleInterest = (interest: Interest) => {
    onChange(
      value.includes(interest)
        ? value.filter(i => i !== interest)
        : [...value, interest]
    )
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium mb-4">{tRoot('selectInterest')}</legend>
      <div className="grid grid-cols-2 gap-4">
        {leftColumnInterests.map((leftInterest, index) => {
          const rightInterest = rightColumnInterests[index]
          return (
            <React.Fragment key={leftInterest}>
              <Button
                fullWidth
                variant={value.includes(leftInterest) ? "contained" : "outlined"}
                onClick={() => toggleInterest(leftInterest)}
                className="h-full"
              >
                {t(leftInterest)}
              </Button>
              <Button
                fullWidth
                variant={value.includes(rightInterest) ? "contained" : "outlined"}
                onClick={() => toggleInterest(rightInterest)}
                className="h-full"
              >
                {t(rightInterest)}
              </Button>
            </React.Fragment>
          )
        })}
      </div>
    </fieldset>
  )
} 