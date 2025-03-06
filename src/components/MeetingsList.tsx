'use client'

import { useQuery } from '@apollo/client'
import { Paper, List, ListItem, Typography, IconButton } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTranslations } from 'next-intl'
import MeetingCard from './MeetingCard'
import { getUserId } from '@/lib/userId'

import { gql } from '@apollo/client'
import MeetingDialog from './MeetingDialog'
import { useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import EventIcon from '@mui/icons-material/Event'
import DeleteIcon from '@mui/icons-material/Delete'
import { Meeting } from '@/generated/graphql'
import { useDeleteMeeting } from '@/hooks/useDeleteMeeting'
import ConfirmDialog from './ConfirmDialog'

export const GET_MEETINGS = gql`
  query GetMeetings($userId: ID!) {
    meetings(userId: $userId) {
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
      }
      peerMeeting {
        _id
        userId
        languages
        statuses
      }
      peerUser {
        userId
        name
        hasImage
        online
        sex
      }
    }
  }
` 

export default function MeetingsList() {
  const { data, loading, error, refetch } = useQuery(GET_MEETINGS, {
    variables: { userId: getUserId() }
  })
  const t = useTranslations()
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const { deleteMeeting } = useDeleteMeeting()
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null)

  const handleEditMeeting = (meetingData: any) => {
    setSelectedMeeting(meetingData.meeting)
    setMeetingDialogOpen(true)
  }

  const handleCreateMeeting = () => {
    setSelectedMeeting(null)
    setMeetingDialogOpen(true)
  }

  const handleDeleteMeeting = async (meetingId: string) => {
    setMeetingToDelete(meetingId)
    setConfirmDialogOpen(true)
  }
  
  const confirmDelete = async () => {
    if (meetingToDelete) {
      await deleteMeeting(meetingToDelete)
      setConfirmDialogOpen(false)
      setMeetingToDelete(null)
      refetch()
    }
  }
  
  const cancelDelete = () => {
    setConfirmDialogOpen(false)
    setMeetingToDelete(null)
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
              onClick={() => setMeetingDialogOpen(true)} 
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
          {data?.meetings.map((meetingData: any) => (
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
                onDelete={(e) => {
                  e?.stopPropagation();
                  handleDeleteMeeting(meetingData.meeting._id);
                }}
              />
            </ListItem>
          ))}
          {data?.meetings.length === 0 && (
            <Typography className="text-gray-400 text-center py-4">
              {t('noMeetings')}
            </Typography>
          )}
        </List>
      </Paper>
      <MeetingDialog
        meetings={data?.meetings}
        meeting={selectedMeeting}
        open={meetingDialogOpen}
        onClose={() => {
          setMeetingDialogOpen(false)
          setSelectedMeeting(null)
        }}
      />
      <ConfirmDialog
        open={confirmDialogOpen}
        title={t('deleteMeeting')}
        message={t('confirmDeleteMeeting')}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  )
} 