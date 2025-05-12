'use client'

import React from 'react'
import { Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Interest } from '@/generated/graphql'
import { getMatchingInterest } from '@/utils/meetingUtils'

interface InterestSelectorProps {
  value: Interest[]
  onChange: (interests: Interest[]) => void
  interestsToMatch?: Interest[]
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

export default function InterestSelector({ value, onChange, interestsToMatch }: InterestSelectorProps) {
  const t = useTranslations('Interest')
  const tRoot = useTranslations()

  // Always show all interests if no filter, otherwise only those that match
  const leftColumnInterests = Array.from(interestRelationships.keys())
  const rightColumnInterests = Array.from(new Set(interestRelationships.values()))

  const isInterestVisible = (interest: Interest) =>
    !interestsToMatch ||
    interestsToMatch.some(match => getMatchingInterest(interest) === match)

  const isInterestDisabled = (interest: Interest) =>
    interestsToMatch &&
    interestsToMatch.includes(interest) &&
    interest !== getMatchingInterest(interest)

  const toggleInterest = (interest: Interest) => {
    if (isInterestDisabled(interest)) return
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
          // Only show row if at least one column is visible
          const rowVisible = isInterestVisible(leftInterest) || isInterestVisible(rightInterest)
          if (!rowVisible) {
            return null
          }
          return (
            <React.Fragment key={leftInterest}>
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
    </fieldset>
  )
} 