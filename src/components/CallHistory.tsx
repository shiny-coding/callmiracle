import { gql, useQuery } from '@apollo/client'
import { Paper, List, ListItem, Typography, Chip, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import { CallHistoryEntry, User } from '@/generated/graphql'
import UserCard from './UserCard'
import { formatDuration } from '@/utils/formatDuration'
import { useStore } from '@/store/useStore'
import LoadingDialog from './LoadingDialog'
import HistoryIcon from '@mui/icons-material/History'
import CloseIcon from '@mui/icons-material/Close'
import { useRouter } from 'next/navigation'
import PageHeader from './PageHeader'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

const CALL_HISTORY = gql`
  query CallHistory($userId: ID!) {
    getCallHistory(userId: $userId) {
      user {
        _id
        name
        sex
        languages
      }
      lastCallAt
      durationS
      totalCalls
    }
  }
`

export default function CallHistory() {
  const { currentUser } = useStore((state: any) => ({ currentUser: state.currentUser }))
  const router = useRouter()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { data, loading, error } = useQuery(CALL_HISTORY, {
    variables: { userId: currentUser?._id }
  })
  const t = useTranslations()

  const callHistory = data?.getCallHistory || []

  // Set up virtualizer
  const virtualizer = useVirtualizer({
    count: callHistory.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 180, // Estimated call history entry height
    overscan: 5, // Render 5 extra items above and below viewport
  })

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Paper className="bg-gray-800 flex flex-col h-full">
      <PageHeader
        icon={<HistoryIcon />}
        title={t('callHistory')}
      >
        <IconButton
          onClick={() => router.back()}
          aria-label={t('close')}
          title={t('close')}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </PageHeader>

      <div
        ref={scrollContainerRef}
        className="flex-grow overflow-y-auto px-4"
        style={{ position: 'relative' }}
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
                    paddingBottom: '8px',
                  }}
                >
                  <ListItem className="flex flex-col items-start hover:bg-gray-700 rounded-lg">
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-grow">
                          <UserCard
                            user={entry.user}
                            showDetails={false}
                            showCallButton={true}
                            showHistoryButton={true}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Chip
                          label={`${entry.totalCalls} calls`}
                          size="small"
                          className="text-xs text-white bg-gray-700"
                        />
                        <Chip
                          label={`Last call: ${formatDate(entry.lastCallAt)}`}
                          size="small"
                          className="text-xs text-white bg-gray-700"
                        />
                        <Chip
                          label={`Total duration: ${formatDuration(entry.durationS)}`}
                          size="small"
                          className="text-xs text-white bg-gray-700"
                        />
                      </div>
                    </div>
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