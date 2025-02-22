import { gql, useQuery } from '@apollo/client'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import { getUserId } from '@/lib/userId'
import { formatDuration } from '@/utils/formatDuration'

const DETAILED_CALL_HISTORY = gql`
  query DetailedCallHistory($userId: ID!, $targetUserId: ID!) {
    detailedCallHistory(userId: $userId, targetUserId: $targetUserId) {
      _id
      initiatorUserId
      targetUserId
      type
      duration
    }
  }
`

interface DetailedCallHistoryProps {
  user: User
  open: boolean
  onClose: () => void
}

export default function DetailedCallHistory({ user, open, onClose }: DetailedCallHistoryProps) {
  const t = useTranslations()
  const { data, loading, error } = useQuery(DETAILED_CALL_HISTORY, {
    variables: { 
      userId: getUserId(),
      targetUserId: user.userId
    },
    skip: !open
  })

  const formatDate = (id: string) => {
    // MongoDB ObjectId contains a timestamp in the first 4 bytes
    const timestamp = parseInt(id.substring(0, 8), 16) * 1000
    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'bg-gray-900 text-white'
      }}
    >
      <DialogTitle className="flex items-center gap-4">
        <div className="text-xl">
          {t('callHistoryWith')} {user.name}
        </div>
      </DialogTitle>
      <DialogContent>
        {loading && <Typography>Loading...</Typography>}
        {error && <Typography color="error">Error loading call history</Typography>}
        {data && (
          <List>
            {data.detailedCallHistory.map((call: any) => (
              <ListItem 
                key={call._id}
                className="flex flex-col items-start py-2"
              >
                <div className="flex justify-between w-full items-center">
                  <Typography>
                    {formatDate(call._id)}
                  </Typography>
                  <Typography className="text-gray-400">
                    {formatDuration(call.duration)}
                  </Typography>
                </div>
              </ListItem>
            ))}
            {data.detailedCallHistory.length === 0 && (
              <Typography className="text-center py-4 text-gray-400">
                {t('noCallHistory')}
              </Typography>
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions className="border-t border-gray-800">
        <Button onClick={onClose}>
          {t('close')}
        </Button>
      </DialogActions>
    </Dialog>
  )
} 