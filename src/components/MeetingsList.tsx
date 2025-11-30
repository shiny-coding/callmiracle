'use client'

import { Paper, List, ListItem, Typography, IconButton, Box } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTranslations } from 'next-intl'
import MeetingCard from './MeetingCard'
import { useRouter, useSearchParams } from 'next/navigation'
import { routerPush } from '@/utils/routerHelper'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import AddIcon from '@mui/icons-material/Add'
import ViewListIcon from '@mui/icons-material/ViewList'
import AddFab from './AddFab'
import CloseIcon from '@mui/icons-material/Close'
import { Meeting, MeetingWithPeer } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { isProfileComplete } from '@/utils/userUtils'
import { getMeetingColorClass, class2Hex, isMeetingPassed } from '@/utils/meetingUtils'
import ProfileIncompleteDialog from './ProfileIncompleteDialog'
import { useMeetings } from '@/contexts/MeetingsContext'
import LoadingDialog from './LoadingDialog'
import { NetworkStatus } from '@apollo/client'
import PageHeader from './PageHeader'

// Shared constant for list bottom padding
export const LIST_BOTTOM_PADDING = '4.5rem'

export default function MeetingsList() {

  const t = useTranslations()
  const [profileIncompleteDialogOpen, setProfileIncompleteDialogOpen] = useState(false)
  const { highlightedMeetingId, setHighlightedMeetingId, myMeetingsWithPeers, loadingMyMeetingsWithPeers, errorMyMeetingsWithPeers, refetchMyMeetingsWithPeers, networkStatusMyMeetings, isUserInitiatedLoading } = useMeetings()
  const meetingRefs = useRef<Record<string, HTMLElement>>({})
  const { currentUser } = useStore(state => ({ currentUser: state.currentUser, }))
  const router = useRouter()
  const searchParams = useSearchParams()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  // Prepare meetings list for virtualization
  const meetingsToRender = useMemo(() => {
    // Only show empty state when there are truly no meetings
    const noMeetingsExist = myMeetingsWithPeers.length === 0

    // Add empty state as first item if needed
    return noMeetingsExist
      ? [{ type: 'empty' as const }]
      : myMeetingsWithPeers
  }, [myMeetingsWithPeers])

  // Set up virtualizer - must be called unconditionally
  const virtualizer = useVirtualizer({
    count: meetingsToRender.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      // Empty state card is larger
      if ('type' in meetingsToRender[index] && meetingsToRender[index].type === 'empty') {
        return 210 // Empty state height
      }
      return 200 // Estimated meeting card height
    },
    overscan: 3, // Render 3 extra items above and below viewport
  })

  const isLoading = isUserInitiatedLoading ||
                   (networkStatusMyMeetings === NetworkStatus.loading)

  if (isLoading || errorMyMeetingsWithPeers) {
    return <LoadingDialog loading={isLoading} error={errorMyMeetingsWithPeers} />
  }

  const handleAddNewMeetingClick = () => {
    if (!isProfileComplete(currentUser)) {
      setProfileIncompleteDialogOpen(true)
      return
    }
    routerPush(router, '/meeting', {
      source: 'add_new_meeting_click',
      userComplete: isProfileComplete(currentUser)
    })
  }

  return (
    <>
      <Paper className=" flex flex-col h-full relative">
        <PageHeader
          icon={<ViewListIcon className="dimmer-text-color" />}
          title={t('myMeetings')}
        >
          <IconButton
            onClick={() => refetchMyMeetingsWithPeers(true)}
            size="small"
            className="hover:bg-gray-700 text-white"
            title={t('refreshMeetings')}
          >
            <RefreshIcon className="text-white" />
          </IconButton>
        </PageHeader>
        
        <div
          ref={scrollContainerRef}
          className="flex-grow overflow-y-auto px-12sp"
          style={{ position: 'relative' }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
              paddingBottom: LIST_BOTTOM_PADDING,
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = meetingsToRender[virtualItem.index]
              const isEmptyState = 'type' in item && item.type === 'empty'

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
                    paddingBottom: 'var(--20sp)',
                  }}
                >
                  {isEmptyState ? (
                    <ListItem
                      onClick={handleAddNewMeetingClick}
                      className="p-8 card-bg rounded-lg cursor-pointer shadow-lg"
                      sx={{ minHeight: '178px' }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                        <AddIcon sx={{ fontSize: 30, color: 'white' }} />
                        <Typography variant="h6" className="mt-2 text-white">
                          {t('addNewMeetingPrompt')}
                        </Typography>
                      </Box>
                    </ListItem>
                  ) : (
                    <ListItem
                      key={(item as MeetingWithPeer).meeting._id}
                      ref={(el: any) => el && (meetingRefs.current[(item as MeetingWithPeer).meeting._id] = el)}
                      className={`flex flex-col p-4 card-bg rounded-lg relative transition-all duration-500
                        ${highlightedMeetingId === (item as MeetingWithPeer).meeting._id ? 'highlight-animation' : ''}`}
                      disablePadding
                      style={isMeetingPassed((item as MeetingWithPeer).meeting) ? undefined : { border: `1px solid ${class2Hex(getMeetingColorClass((item as MeetingWithPeer).meeting))}` }}
                    >
                      <MeetingCard
                        meetingWithPeer={item as MeetingWithPeer}
                        onEdit={e => {
                          e?.stopPropagation()
                          routerPush(router, `/meeting/${(item as MeetingWithPeer).meeting._id}`, {
                            source: 'meeting_card_edit_click',
                            meetingId: (item as MeetingWithPeer).meeting._id,
                            meetingStatus: (item as MeetingWithPeer).meeting.status
                          })
                        }}
                      />
                    </ListItem>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <AddFab
          onClick={handleAddNewMeetingClick}
          ariaLabel={t('createNewMeeting')}
          title={t('createNewMeeting')}
        />
      </Paper>
      <ProfileIncompleteDialog
        open={profileIncompleteDialogOpen}
        onClose={() => setProfileIncompleteDialogOpen(false)}
      />
    </>
  )
} 