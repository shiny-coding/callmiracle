'use client'

import React from 'react'
import { Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Status } from '@/generated/graphql'

interface StatusSelectorProps {
  value: Status[]
  onChange: (statuses: Status[]) => void
}

// Define the status relationships map
export const statusRelationships = new Map<Status, Status>([
  [Status.Chat, Status.Chat],
  [Status.MeetNewPeople, Status.MeetNewPeople],
  [Status.SitTogetherInSilence, Status.SitTogetherInSilence],
  [Status.NeedHelpWithSituation, Status.WantToHelpWithSituation],
  [Status.WantToSpeakOut, Status.WantToListen],
])

export default function StatusSelector({ value, onChange }: StatusSelectorProps) {
  const t = useTranslations('Status')
  const tRoot = useTranslations()

  // Split statuses into left and right columns
  const leftColumnStatuses = Array.from(statusRelationships.keys())
  const rightColumnStatuses = Array.from(new Set(statusRelationships.values()))

  const toggleStatus = (status: Status) => {
    onChange(
      value.includes(status)
        ? value.filter(s => s !== status)
        : [...value, status]
    )
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium mb-4">{tRoot('selectStatus')}</legend>
      <div className="grid grid-cols-2 gap-4">
        {leftColumnStatuses.map((leftStatus, index) => {
          const rightStatus = rightColumnStatuses[index]
          return (
            <React.Fragment key={leftStatus}>
              <Button
                fullWidth
                variant={value.includes(leftStatus) ? "contained" : "outlined"}
                onClick={() => toggleStatus(leftStatus)}
                color={value.includes(leftStatus) ? "primary" : "inherit"}
                className="h-full"
              >
                {t(leftStatus)}
              </Button>
              <Button
                fullWidth
                variant={value.includes(rightStatus) ? "contained" : "outlined"}
                onClick={() => toggleStatus(rightStatus)}
                color={value.includes(rightStatus) ? "primary" : "inherit"}
                className="h-full"
              >
                {t(rightStatus)}
              </Button>
            </React.Fragment>
          )
        })}
      </div>
    </fieldset>
  )
} 