'use client'

import { IconButton } from '@mui/material'
import CallEndIcon from '@mui/icons-material/CallEnd'
import HistoryIcon from '@mui/icons-material/History'
import PersonIcon from '@mui/icons-material/Person'
import GroupIcon from '@mui/icons-material/Group'
import ListIcon from '@mui/icons-material/List'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import MessageIcon from '@mui/icons-material/Message'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useRouter, usePathname  } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useConversations } from '@/store/ConversationsProvider'
import { routerPush } from '@/utils/routerHelper'
import NotificationBadge from './NotificationBadge'

export default function BottomControlsBar() {
  
  const {
    connectionStatus,
    hangup,
  } = useWebRTCContext()

  const { hasUnreadConversations } = useConversations()

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

  return (
    <>
      <div className="mt-auto p-3 w-full flex justify-center items-center gap-4 bg-gradient-to-b from-transparent to-white/30">
        {connectionStatus !== 'connected' && (
          <>
            <IconButton onClick={() => routerPush(router, calendarPath, { source: 'bottom_controls_calendar', currentPath: pathname })} style={{ color: pathname === calendarPath ? selectedColor : undefined, }} >
              <CalendarMonthIcon />
            </IconButton>
            <IconButton onClick={() => routerPush(router, listPath, { source: 'bottom_controls_list', currentPath: pathname })} style={{ color: pathname === listPath ? selectedColor : undefined, }} >
              <ListIcon />
            </IconButton>

            <IconButton onClick={() => routerPush(router, usersPath, { source: 'bottom_controls_users', currentPath: pathname })} style={{ color: pathname === usersPath ? selectedColor : undefined, }} >
              <PersonIcon />
            </IconButton>
            
            <IconButton onClick={() => routerPush(router, groupsPath, { source: 'bottom_controls_groups', currentPath: pathname })} style={{ color: pathname === groupsPath ? selectedColor : undefined, }} >
              <GroupIcon />
            </IconButton>
            
            <IconButton onClick={() => routerPush(router, conversationsPath, { source: 'bottom_controls_conversations', currentPath: pathname, hasUnreadConversations })} style={{ color: pathname === conversationsPath ? selectedColor : undefined, }} >
              <NotificationBadge show={hasUnreadConversations}>
                <MessageIcon />
              </NotificationBadge>
            </IconButton>
            
            <IconButton onClick={() => routerPush(router, callHistoryPath, { source: 'bottom_controls_call_history', currentPath: pathname })} style={{ color: pathname === callHistoryPath ? selectedColor : undefined, }} >
              <HistoryIcon />
            </IconButton>
          </>
        )}
        {connectionStatus === 'connected' && (
          <div>
            <IconButton
              className="bg-red-600 hover:bg-red-700 text-white" 
              onClick={hangup}
            >
              <CallEndIcon className="text-red-400" />
            </IconButton>
          </div>
        )}
      </div>
    </>
  )
} 