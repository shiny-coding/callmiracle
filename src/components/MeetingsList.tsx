'use client'

import { useQuery } from '@apollo/client'
import { Paper, List, ListItem, Typography, IconButton } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTranslations } from 'next-intl'
import MeetingCard from './MeetingCard'

import { gql } from '@apollo/client'
import MeetingDialog from './MeetingDialog'
import { useState, useEffect } from 'react'
import AddIcon from '@mui/icons-material/Add'
import EventIcon from '@mui/icons-material/Event'
import { Meeting } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { isProfileComplete } from '@/utils/userUtils'
import ProfileIncompleteDialog from './ProfileIncompleteDialog'
import { useSubscriptions } from '@/contexts/SubscriptionsContext'

export const GET_MEETINGS = gql`
  query GetMeetings($userId: ID!) {
    getMeetings(userId: $userId) {
      meeting {
        _id
        userId
        languages
        statuses
        timeSlots
        minDuration
        preferEarlier
        allowedMales
        allowedFemales
        allowedMinAge
        allowedMaxAge
        startTime
        peerMeetingId
        lastCallTime
        status
        totalDuration
      }
      peerMeeting {
        _id
        userId
        languages
        statuses
      }
      peerUser {
        _id
        name
        hasImage
        online
        sex
        languages
      }
    }
  }
` 

export default function MeetingsList() {
  const { currentUser } = useStore()
  const { data, loading, error, refetch } = useQuery(GET_MEETINGS, {
    variables: { userId: currentUser?._id }
  })
  const t = useTranslations()
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [profileIncompleteDialogOpen, setProfileIncompleteDialogOpen] = useState(false)
  const { subscribeToNotifications } = useSubscriptions()

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((event) => {
      if (event.type.startsWith('meeting-')) {
        refetch();
      }
    })
    
    return unsubscribe
  }, [subscribeToNotifications, refetch])

  const handleEditMeeting = (meetingData: any) => {
    setSelectedMeeting(meetingData.meeting)
    setMeetingDialogOpen(true)
  }

  const handleCreateMeeting = () => {
    if (!isProfileComplete(currentUser)) {
      setProfileIncompleteDialogOpen(true)
      return
    }
    setSelectedMeeting(null)
    setMeetingDialogOpen(true)
  }

  if (loading) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading meetings</Typography>


  return (
    <div className="w-full">
      <Paper className="p-4 bg-gray-800">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <EventIcon className="text-blue-400" />
            <Typography variant="h6">
              {t('myMeetings')}
            </Typography>
          </div>
          <div className="flex gap-2">
            <IconButton 
              onClick={handleCreateMeeting} 
              size="small"
              className="hover:bg-gray-700 text-white"
            >
              <AddIcon className="text-white" />
            </IconButton>
            <IconButton 
              onClick={() => refetch()} 
              size="small"
              className="hover:bg-gray-700 text-white"
            >
              <RefreshIcon className="text-white" />
            </IconButton>
          </div>
        </div>
        <List className="space-y-4">
          {data?.getMeetings.map((meetingData: any) => (
            <ListItem 
              key={meetingData.meeting._id}
              className="flex flex-col p-4 bg-gray-700 rounded-lg hover:bg-gray-600 relative mb-4"
              disablePadding
            >
              <MeetingCard 
                meetingWithPeer={meetingData} 
                onEdit={(e) => {
                  e?.stopPropagation();
                  handleEditMeeting(meetingData);
                }}
                refetch={refetch}
              />
            </ListItem>
          ))}
          {data?.getMeetings.length === 0 && (
            <Typography className="text-gray-400 text-center py-4">
              {t('noMeetings')}
            </Typography>
          )}
        </List>
      </Paper>
      <MeetingDialog
        meetings={data?.getMeetings}
        meeting={selectedMeeting}
        open={meetingDialogOpen}
        onClose={() => {
          setMeetingDialogOpen(false)
          setSelectedMeeting(null)
        }}
      />
      <ProfileIncompleteDialog
        open={profileIncompleteDialogOpen}
        onClose={() => setProfileIncompleteDialogOpen(false)}
      />
    </div>
  )
} 