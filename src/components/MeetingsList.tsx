'use client'

import { Paper, List, ListItem, Typography, IconButton } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTranslations } from 'next-intl'
import MeetingCard from './MeetingCard'
import { useRouter } from 'next/navigation'

import { useState, useEffect, useRef, useMemo } from 'react'
import AddIcon from '@mui/icons-material/Add'
import EventIcon from '@mui/icons-material/Event'
import { Meeting } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { isProfileComplete } from '@/utils/userUtils'
import ProfileIncompleteDialog from './ProfileIncompleteDialog'
import { useSubscriptions } from '@/contexts/SubscriptionsContext'
import { useMeetings } from '@/contexts/MeetingsContext'

export default function MeetingsList() {

  const t = useTranslations()
  const [profileIncompleteDialogOpen, setProfileIncompleteDialogOpen] = useState(false)
  const { subscribeToNotifications } = useSubscriptions()
  const { highlightedMeetingId, setHighlightedMeetingId, meetings, loading, error, refetch } = useMeetings()
  const meetingRefs = useRef<Record<string, HTMLElement>>({})
  const { currentUser } = useStore()
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((event) => {
      if (event.type.startsWith('meeting-')) {
        refetch();
      }
    })
    
    return unsubscribe
  }, [subscribeToNotifications, refetch])

  useEffect(() => {
    if (highlightedMeetingId && meetingRefs.current[highlightedMeetingId]) {
      meetingRefs.current[highlightedMeetingId].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      })
    }
  }, [highlightedMeetingId])

  useEffect(() => {
    if (highlightedMeetingId) {
      const timer = setTimeout(() => {
        setHighlightedMeetingId(null)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [highlightedMeetingId, setHighlightedMeetingId])


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
              onClick={() => {
                if (!isProfileComplete(currentUser)) {
                  setProfileIncompleteDialogOpen(true)
                  return
                }
                router.push('/meeting')
              }}
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
          {meetings.map((meetingData: any) => (
            <ListItem 
              key={meetingData.meeting._id}
              ref={(el: any) => el && (meetingRefs.current[meetingData.meeting._id] = el)}
              className={`flex flex-col p-4 bg-gray-700 rounded-lg hover:bg-gray-600 relative mb-4 transition-all duration-500
                ${highlightedMeetingId === meetingData.meeting._id ? 'highlight-animation' : ''}`}
              disablePadding
            >
              <MeetingCard 
                meetingWithPeer={meetingData} 
                onEdit={e => {
                  e?.stopPropagation()
                  router.push(`/meeting/${meetingData.meeting._id}`)
                }}
                refetch={refetch}
              />
            </ListItem>
          ))}
          {meetings.length === 0 && (
            <Typography className="text-gray-400 text-center py-4">
              {t('noMeetings')}
            </Typography>
          )}
        </List>
      </Paper>
      <ProfileIncompleteDialog
        open={profileIncompleteDialogOpen}
        onClose={() => setProfileIncompleteDialogOpen(false)}
      />
    </div>
  )
} 