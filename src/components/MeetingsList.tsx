'use client'

import { useQuery } from '@apollo/client'
import { Paper, List, ListItem, Typography, IconButton } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTranslations } from 'next-intl'
import MeetingCard from './MeetingCard'
import { getUserId } from '@/lib/userId'

import { gql } from '@apollo/client'

export const GET_MEETINGS = gql`
  query GetMeetings($userId: ID!) {
    meetings(userId: $userId) {
      userId
      statuses
      timeSlots
      minDuration
      preferEarlier
    }
  }
` 
export default function MeetingsList() {
  const { data, loading, error, refetch } = useQuery(GET_MEETINGS, {
    variables: { userId: getUserId() }
  })
  const t = useTranslations()

  if (loading) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading meetings</Typography>

  return (
    <Paper className="p-4 relative bg-gray-800">
      <div className="flex justify-between items-center mb-4 absolute top-0 right-0">
        <IconButton 
          onClick={() => refetch()} 
          size="small"
          className="hover:bg-gray-700 text-white"
        >
          <RefreshIcon className="text-white" />
        </IconButton>
      </div>
      <List>
        {data?.meetings.map((meeting: any) => (
          <ListItem 
            key={`${meeting.userId}-${meeting.timeSlots[0]}`}
            className="flex flex-col items-start hover:bg-gray-700 rounded-lg"
          >
            <div className="w-full">
              <MeetingCard meeting={meeting} />
            </div>
          </ListItem>
        ))}
        {data?.meetings.length === 0 && (
          <Typography className="text-gray-400 text-center py-4">
            {t('noMeetings')}
          </Typography>
        )}
      </List>
    </Paper>
  )
} 