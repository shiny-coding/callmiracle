'use client'

import { IconButton, Badge } from '@mui/material'
import CallEndIcon from '@mui/icons-material/CallEnd'
import HistoryIcon from '@mui/icons-material/History'
import PersonIcon from '@mui/icons-material/Person'
import GroupIcon from '@mui/icons-material/Group'
import ListIcon from '@mui/icons-material/List'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import MessageIcon from '@mui/icons-material/Message'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useConversations } from '@/store/ConversationsProvider'
import { routerPush } from '@/utils/routerHelper'
import NotificationBadge from './NotificationBadge'
import { useStore } from '@/store/useStore'
import MediaControls from './MediaControls'
import P2PStatusIcon from './P2PStatusIcon'
import P2PConnectionDialog from './P2PConnectionDialog'
import { useP2PConnectivityCheck } from '@/hooks/useP2PConnectivityCheck'
import { useMeetings } from '@/contexts/MeetingsContext'
import { getHighestPriorityMeetingColor, class2Hex } from '@/utils/meetingUtils'

interface ControlsBarProps {
  position: 'top' | 'bottom'
  isCompact: boolean
  className?: string
}

export default function ControlsBar({ position, isCompact, className = '' }: ControlsBarProps) {
  const { connectionStatus, hangup } = useWebRTCContext()
  const { hasUnreadConversations } = useConversations()
  const currentUser = useStore((state: any) => state.currentUser)
  const { status: p2pStatus, isDialogOpen, diagnostics, closeDialog, openDialog, recheckManually } = useP2PConnectivityCheck()
  const { myMeetingsWithPeers } = useMeetings()

  const handleP2PIconClick = () => {
    // Always open dialog, even when checking
    openDialog()
  }

  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const listPath = `/${locale}/list`
  const calendarPath = `/${locale}/calendar`
  const usersPath = `/${locale}/users`
  const groupsPath = `/${locale}/groups`
  const conversationsPath = `/${locale}/conversations`
  const callHistoryPath = `/${locale}/call-history`

  const selectedColor = '#60a5fa'

  // Get the highest priority meeting color for the status dot
  const meetings = myMeetingsWithPeers.map(m => m.meeting)
  const meetingColorClass = getHighestPriorityMeetingColor(meetings)
  const meetingColor = meetingColorClass ? class2Hex(meetingColorClass) : null

  // Calendar icon with status dot
  const CalendarIconWithDot = () => (
    <Badge
      variant="dot"
      invisible={!meetingColor}
      sx={{
        '& .MuiBadge-dot': {
          backgroundColor: meetingColor || 'transparent',
          right: -2,
        }
      }}
    >
      <CalendarMonthIcon />
    </Badge>
  )

  // Top bar layout (non-compact)
  if (position === 'top' && !isCompact) {
    return (
      <div className={`p-3 w-full flex items-center ${className}`} style={{ justifyContent: 'space-between', position: 'relative', zIndex: 1400 }}>
        <div className="flex items-center gap-2">
          <MediaControls showNotifications={true} showMediaButtons={false} showProfile={false} />
        </div>

        <div className="flex items-center">
          <MediaControls showNotifications={false} showMediaButtons={true} showProfile={false} />
        </div>

        <div className="flex gap-3 items-center overflow-hidden">
          <div className="text-sm text-white/80 capitalize overflow-hidden text-ellipsis whitespace-nowrap">
            {currentUser?.name}
          </div>
          <MediaControls showNotifications={false} showMediaButtons={false} showProfile={true} />
        </div>
      </div>
    )
  }

  // Bottom bar - navigation only (non-compact)
  if (position === 'bottom' && !isCompact) {
    return (
      <>
        <div className={`mt-auto p-3 w-full flex items-center gap-4 ${className}`} style={{ justifyContent: 'space-between', position: 'relative', zIndex: 1400 }}>
          {connectionStatus !== 'connected' && (
            <>
              <div style={{ width: '48px' }} /> {/* Spacer for balance */}
              <div className="flex items-center gap-4" style={{ justifyContent: 'center' }}>
                <IconButton onClick={() => routerPush(router, calendarPath, { source: 'bottom_controls_calendar', currentPath: pathname })} className={pathname === calendarPath ? '' : 'icon-gradient'} style={{ color: pathname === calendarPath ? selectedColor : undefined }}>
                  <CalendarIconWithDot />
                </IconButton>
                <IconButton onClick={() => routerPush(router, listPath, { source: 'bottom_controls_list', currentPath: pathname })} className={pathname === listPath ? '' : 'icon-gradient'} style={{ color: pathname === listPath ? selectedColor : undefined }}>
                  <ListIcon />
                </IconButton>
                <IconButton onClick={() => routerPush(router, usersPath, { source: 'bottom_controls_users', currentPath: pathname })} className={pathname === usersPath ? '' : 'icon-gradient'} style={{ color: pathname === usersPath ? selectedColor : undefined }}>
                  <PersonIcon />
                </IconButton>
                <IconButton onClick={() => routerPush(router, groupsPath, { source: 'bottom_controls_groups', currentPath: pathname })} className={pathname === groupsPath ? '' : 'icon-gradient'} style={{ color: pathname === groupsPath ? selectedColor : undefined }}>
                  <GroupIcon />
                </IconButton>
                <IconButton onClick={() => routerPush(router, conversationsPath, { source: 'bottom_controls_conversations', currentPath: pathname, hasUnreadConversations })} className={pathname === conversationsPath ? '' : 'icon-gradient'} style={{ color: pathname === conversationsPath ? selectedColor : undefined }}>
                  <NotificationBadge show={hasUnreadConversations}>
                    <MessageIcon />
                  </NotificationBadge>
                </IconButton>
                <IconButton onClick={() => routerPush(router, callHistoryPath, { source: 'bottom_controls_call_history', currentPath: pathname })} className={pathname === callHistoryPath ? '' : 'icon-gradient'} style={{ color: pathname === callHistoryPath ? selectedColor : undefined }}>
                  <HistoryIcon />
                </IconButton>
              </div>
              <P2PStatusIcon status={p2pStatus} onClick={handleP2PIconClick} />
            </>
          )}
          {connectionStatus === 'connected' && (
            <div>
              <IconButton className="bg-red-600 hover:bg-red-700 text-white" onClick={hangup}>
                <CallEndIcon className="text-red-400" />
              </IconButton>
            </div>
          )}
        </div>
        <P2PConnectionDialog open={isDialogOpen} status={p2pStatus} diagnostics={diagnostics} onClose={closeDialog} onRecheck={recheckManually} />
      </>
    )
  }

  // Bottom bar - compact layout (all controls)
  if (position === 'bottom' && isCompact) {
    return (
      <>
        <div className={`mt-auto p-2 w-full flex items-center gap-4 ${className}`} style={{ justifyContent: 'space-between', position: 'relative', zIndex: 1400 }}>
          {connectionStatus !== 'connected' && (
            <>
              {/* Notification button on left */}
              <MediaControls showNotifications={true} showMediaButtons={false} showProfile={false} />

              {/* Navigation buttons in center */}
              <div className="flex items-center gap-4" style={{ justifyContent: 'center' }}>
                <IconButton onClick={() => routerPush(router, calendarPath, { source: 'bottom_controls_calendar', currentPath: pathname })} className={pathname === calendarPath ? '' : 'icon-gradient'} style={{ color: pathname === calendarPath ? selectedColor : undefined }}>
                  <CalendarIconWithDot />
                </IconButton>
                <IconButton onClick={() => routerPush(router, listPath, { source: 'bottom_controls_list', currentPath: pathname })} className={pathname === listPath ? '' : 'icon-gradient'} style={{ color: pathname === listPath ? selectedColor : undefined }}>
                  <ListIcon />
                </IconButton>
                <IconButton onClick={() => routerPush(router, usersPath, { source: 'bottom_controls_users', currentPath: pathname })} className={pathname === usersPath ? '' : 'icon-gradient'} style={{ color: pathname === usersPath ? selectedColor : undefined }}>
                  <PersonIcon />
                </IconButton>
                <IconButton onClick={() => routerPush(router, groupsPath, { source: 'bottom_controls_groups', currentPath: pathname })} className={pathname === groupsPath ? '' : 'icon-gradient'} style={{ color: pathname === groupsPath ? selectedColor : undefined }}>
                  <GroupIcon />
                </IconButton>
                <IconButton onClick={() => routerPush(router, conversationsPath, { source: 'bottom_controls_conversations', currentPath: pathname, hasUnreadConversations })} className={pathname === conversationsPath ? '' : 'icon-gradient'} style={{ color: pathname === conversationsPath ? selectedColor : undefined }}>
                  <NotificationBadge show={hasUnreadConversations}>
                    <MessageIcon />
                  </NotificationBadge>
                </IconButton>
                <IconButton onClick={() => routerPush(router, callHistoryPath, { source: 'bottom_controls_call_history', currentPath: pathname })} className={pathname === callHistoryPath ? '' : 'icon-gradient'} style={{ color: pathname === callHistoryPath ? selectedColor : undefined }}>
                  <HistoryIcon />
                </IconButton>

                {/* Media controls after navigation */}
                <div style={{ width: '16px' }} />
                <MediaControls showNotifications={false} showMediaButtons={true} showProfile={false} />
              </div>

              {/* P2P Status and Profile on right */}
              <div className="flex items-center gap-2">
                <P2PStatusIcon status={p2pStatus} onClick={handleP2PIconClick} />
                <MediaControls showNotifications={false} showMediaButtons={false} showProfile={true} />
              </div>
            </>
          )}
          {connectionStatus === 'connected' && (
            <div>
              <IconButton className="bg-red-600 hover:bg-red-700 text-white" onClick={hangup}>
                <CallEndIcon className="text-red-400" />
              </IconButton>
            </div>
          )}
        </div>
        <P2PConnectionDialog open={isDialogOpen} status={p2pStatus} diagnostics={diagnostics} onClose={closeDialog} onRecheck={recheckManually} />
      </>
    )
  }

  return null
}
