'use client'

import { Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Status } from '@/generated/graphql'
import { useStore } from '@/store/useStore'

// Define the status relationships map
const statusRelationships = new Map<Status, Status>([
  [Status.Chat, Status.Chat],
  [Status.MeetNewPeople, Status.MeetNewPeople],
  [Status.SitTogetherInSilence, Status.SitTogetherInSilence],
  [Status.NeedHelpWithSituation, Status.WantToHelpWithSituation],
  [Status.WantToSpeakOut, Status.WantToListen],
])

export default function StatusSelector() {
  const t = useTranslations('Status')
  const tRoot = useTranslations()
  const { statuses, setStatuses } = useStore()

  // Split statuses into left and right columns
  const leftColumnStatuses = Array.from(statusRelationships.keys())
  const rightColumnStatuses = Array.from(new Set(statusRelationships.values()))

  const toggleStatus = (status: Status) => {
    setStatuses(
      statuses.includes(status)
        ? statuses.filter(s => s !== status)
        : [...statuses, status]
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
              variant={statuses.includes(status) ? "contained" : "outlined"}
              onClick={() => toggleStatus(status)}
              color={statuses.includes(status) ? "primary" : "inherit"}
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
              variant={statuses.includes(status) ? "contained" : "outlined"}
              onClick={() => toggleStatus(status)}
              color={statuses.includes(status) ? "primary" : "inherit"}
            >
              {t(status)}
            </Button>
          ))}
        </div>
      </div>
    </fieldset>
  )
} 