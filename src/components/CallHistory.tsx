import { gql, useQuery } from '@apollo/client'
import { Paper, List, ListItem, Typography, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import UserCard from './UserCard'
import { getUserId } from '@/lib/userId'
import { formatDuration } from '@/utils/formatDuration'

const CALL_HISTORY = gql`
  query CallHistory($userId: ID!) {
    callHistory(userId: $userId) {
      user {
        userId
        name
        statuses
        languages
        timestamp
        locale
        online
        hasImage
      }
      lastCallAt
      duration
      totalCalls
    }
  }
`

interface CallHistoryEntry {
  user: User
  lastCallAt: number
  duration: number
  totalCalls: number
}

export default function CallHistory() {
  const { data, loading, error } = useQuery(CALL_HISTORY, {
    variables: { userId: getUserId() }
  })
  const t = useTranslations()

  if (loading) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading call history</Typography>

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
      <Typography variant="h6" className="mb-4 text-white">
        {t('callHistory')}
      </Typography>
      <List>
        {data?.callHistory.map((entry: CallHistoryEntry) => (
          <ListItem 
            key={entry.user.userId}
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
                  label={`Total duration: ${formatDuration(entry.duration)}`}
                  size="small"
                  className="text-xs text-white bg-gray-700"
                />
              </div>
            </div>
          </ListItem>
        ))}
        {data?.callHistory.length === 0 && (
          <Typography className="text-gray-400 text-center py-4">
            {t('noCallHistory')}
          </Typography>
        )}
      </List>
    </Paper>
  )
} 