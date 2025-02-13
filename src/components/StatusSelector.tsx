'use client'

import { Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Status } from '@/generated/graphql'

interface StatusSelectorProps {
  value: Status[]
  onChange: (statuses: Status[]) => void
}

// Define the status relationships map
const statusRelationships = new Map<Status, Status>([
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="space-y-3">
          {leftColumnStatuses.map((status) => (
            <Button
              key={status}
              fullWidth
              variant={value.includes(status) ? "contained" : "outlined"}
              onClick={() => toggleStatus(status)}
              color={value.includes(status) ? "primary" : "inherit"}
            >
              {t(status)}
            </Button>
          ))}
        </div>
        <div className="space-y-3">
          {rightColumnStatuses.map((status) => (
            <Button
              key={status}
              fullWidth
              variant={value.includes(status) ? "contained" : "outlined"}
              onClick={() => toggleStatus(status)}
              color={value.includes(status) ? "primary" : "inherit"}
            >
              {t(status)}
            </Button>
          ))}
        </div>
      </div>
    </fieldset>
  )
} 