'use client'

import { Paper, List, ListItem, Typography, IconButton, Box } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTranslations } from 'next-intl'
import MeetingCard from './MeetingCard'
import { useRouter, useSearchParams } from 'next/navigation'

import { useState, useEffect, useRef, useMemo } from 'react'
import AddIcon from '@mui/icons-material/Add'
import EventIcon from '@mui/icons-material/Event'
import ViewListIcon from '@mui/icons-material/ViewList'
import { Meeting, MeetingWithPeer } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { isProfileComplete } from '@/utils/userUtils'
import { isMeetingPassed } from '@/utils/meetingUtils'
import ProfileIncompleteDialog from './ProfileIncompleteDialog'
import { useMeetings } from '@/contexts/MeetingsContext'
import LoadingDialog from './LoadingDialog'
import { NetworkStatus } from '@apollo/client'

export default function MeetingsList() {

  const t = useTranslations()
  const [profileIncompleteDialogOpen, setProfileIncompleteDialogOpen] = useState(false)
  const { highlightedMeetingId, setHighlightedMeetingId, myMeetingsWithPeers, loadingMyMeetingsWithPeers, errorMyMeetingsWithPeers, refetchMyMeetingsWithPeers, networkStatusMyMeetings } = useMeetings()
  const meetingRefs = useRef<Record<string, HTMLElement>>({})
  const { currentUser } = useStore(state => ({ currentUser: state.currentUser, }))
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (highlightedMeetingId && meetingRefs.current[highlightedMeetingId]) {
      const el = meetingRefs.current[highlightedMeetingId]
      // Find the scrollable container (the Paper element)
      const container = el?.closest('.MuiPaper-root')
      if (el && container) {
        const elRect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        // Check if the element is fully in view
        if (
          elRect.top < containerRect.top ||
          elRect.bottom > containerRect.bottom
        ) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
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

  useEffect(() => {
    const meetingId = searchParams?.get('meetingId')
    if (meetingId) {
      setHighlightedMeetingId(meetingId)
    }
  }, [searchParams, setHighlightedMeetingId])

  const isLoading = loadingMyMeetingsWithPeers || networkStatusMyMeetings === NetworkStatus.refetch

  if (isLoading || errorMyMeetingsWithPeers) {
    return <LoadingDialog loading={isLoading} error={errorMyMeetingsWithPeers} />
  }

  const handleAddNewMeetingClick = () => {
    if (!isProfileComplete(currentUser)) {
      setProfileIncompleteDialogOpen(true)
      return
    }
    router.push('/meeting')
  }

  const allMeetingsPassedOrNoneExist = 
    myMeetingsWithPeers.length === 0 || 
    myMeetingsWithPeers.every(mwp => isMeetingPassed(mwp.meeting))

  return (
    <div className="w-full">
      <Paper className="p-4 bg-gray-800">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <ViewListIcon className="text-blue-400" />
            <Typography variant="h6">
              {t('myMeetings')}
            </Typography>
          </div>
          <div className="flex gap-2">
            <IconButton
              onClick={handleAddNewMeetingClick}
              size="small"
              className="hover:bg-gray-700 text-white"
            >
              <AddIcon className="text-white" />
            </IconButton>
            <IconButton 
              onClick={() => refetchMyMeetingsWithPeers()} 
              size="small"
              className="hover:bg-gray-700 text-white"
            >
              <RefreshIcon className="text-white" />
            </IconButton>
          </div>
        </div>
        <List className="space-y-4">
          {allMeetingsPassedOrNoneExist && (
            <ListItem 
              onClick={handleAddNewMeetingClick}
              className="p-8 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer shadow-lg"
              sx={{ minHeight: '178px' }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                <AddIcon sx={{ fontSize: 30, color: 'white' }} />
                <Typography variant="h6" className="mt-2 text-white">
                  {t('addNewMeetingPrompt')}
                </Typography>
              </Box>
            </ListItem>
          )}
          {myMeetingsWithPeers.map((meetingWithPeer: MeetingWithPeer) => (
            <ListItem 
              key={meetingWithPeer.meeting._id}
              ref={(el: any) => el && (meetingRefs.current[meetingWithPeer.meeting._id] = el)}
              className={`flex flex-col p-4 bg-gray-700 rounded-lg hover:bg-gray-600 relative mb-4 transition-all duration-500
                ${highlightedMeetingId === meetingWithPeer.meeting._id ? 'highlight-animation' : ''}`}
              disablePadding
            >
              <MeetingCard 
                meetingWithPeer={meetingWithPeer} 
                onEdit={e => {
                  e?.stopPropagation()
                  router.push(`/meeting/${meetingWithPeer.meeting._id}`)
                }}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
      <ProfileIncompleteDialog
        open={profileIncompleteDialogOpen}
        onClose={() => setProfileIncompleteDialogOpen(false)}
      />
    </div>
  )
} 