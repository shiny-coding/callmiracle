import { gql, useQuery } from '@apollo/client'
import { Paper, List, ListItem, Typography, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { CallHistoryEntry, User } from '@/generated/graphql'
import UserCard from './UserCard'
import { formatDuration } from '@/utils/formatDuration'
import { useStore } from '@/store/useStore'
import LoadingDialog from './LoadingDialog'

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
  const { currentUser } = useStore()

  const { data, loading, error } = useQuery(CALL_HISTORY, {
    variables: { userId: currentUser?._id }
  })
  const t = useTranslations()

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
    <Paper className="p-4 bg-gray-800">
      <List>
        {data?.getCallHistory.map((entry: CallHistoryEntry) => (
          <ListItem 
            key={entry.user._id}
            className="flex flex-col items-start hover:bg-gray-700 rounded-lg mb-2"
          >
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
        ))}
        {data?.getCallHistory.length === 0 && (
          <Typography className="text-gray-400 text-center py-4">
            {t('noCallHistory')}
          </Typography>
        )}
      </List>
    </Paper>
  )
} 