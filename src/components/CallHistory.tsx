import { gql, useQuery } from '@apollo/client'
import { Paper, List, ListItem, Typography, Chip, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import CallHistoryUserInfo from './CallHistoryUserInfo'
import { formatDuration } from '@/utils/formatDuration'
import { useStore } from '@/store/useStore'
import LoadingDialog from './LoadingDialog'
import HistoryIcon from '@mui/icons-material/History'
import CloseIcon from '@mui/icons-material/Close'
import { useRouter } from 'next/navigation'
import PageHeader from './PageHeader'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

const INDIVIDUAL_CALL_HISTORY = gql`
  query IndividualCallHistory($userId: ID!) {
    getIndividualCallHistory(userId: $userId) {
      callId
      user {
        _id
        name
        sex
        languages
      }
      callTime
      durationS
      initiatedByMe
    }
  }
`

export default function CallHistory() {
  const { currentUser } = useStore((state: any) => ({ currentUser: state.currentUser }))
  const router = useRouter()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { data, loading, error } = useQuery(INDIVIDUAL_CALL_HISTORY, {
    variables: { userId: currentUser?._id }
  })
  const t = useTranslations()

  const callHistory = data?.getIndividualCallHistory || []

  // Set up virtualizer
  const virtualizer = useVirtualizer({
    count: callHistory.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 180, // Estimated call history entry height
    overscan: 5, // Render 5 extra items above and below viewport
  })

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Paper className=" flex flex-col h-full">
      <PageHeader
        icon={<HistoryIcon className="dimmer-text-color" />}
        title={t('callHistory')}
      >
      </PageHeader>

      <div
        ref={scrollContainerRef}
        className="flex-grow overflow-y-auto list-item-gap"
        style={{ position: 'relative', paddingTop: 'var(--list-item-gap)', paddingBottom: 'var(--list-item-gap)' }}
      >
        {callHistory.length === 0 ? (
          <Typography className="text-gray-400 text-center py-4">
            {t('noCallHistory')}
          </Typography>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const entry = callHistory[virtualItem.index]

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    display: 'block',
                    paddingBottom: 'var(--list-item-gap)',
                  }}
                >
                  <ListItem className="flex items-center card-bg rounded-lg">
                    <div className="flex-grow">
                      <CallHistoryUserInfo user={entry.user} hideActions />

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Chip
                          label={formatDateTime(entry.callTime)}
                          size="small"
                          className="text-xs text-white bg-gray-700"
                        />
                        <Chip
                          label={formatDuration(entry.durationS)}
                          size="small"
                          className="text-xs text-white bg-blue-700"
                        />
                      </div>
                    </div>
                    <CallHistoryUserInfo user={entry.user} actionsOnly />
                  </ListItem>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Paper>
  )
} 