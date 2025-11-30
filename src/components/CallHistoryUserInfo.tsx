'use client'

import { Typography, Chip, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import UserAvatar from './UserAvatar'
import UserDetailsPopup from './UserDetailsPopup'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useState } from 'react'
import CallIcon from '@mui/icons-material/Call'
import MessageIcon from '@mui/icons-material/Message'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { routerPush } from '@/utils/routerHelper'

interface CallHistoryUserInfoProps {
  user: User
  hideActions?: boolean
  actionsOnly?: boolean
}

export default function CallHistoryUserInfo({ user, hideActions, actionsOnly }: CallHistoryUserInfoProps) {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()
  const [detailsPopupOpen, setDetailsPopupOpen] = useState(false)
  const { currentUser } = useStore((state: any) => ({
    currentUser: state.currentUser
  }))
  const { doCall } = useWebRTCContext()

  // Check if this user is a friend
  const isFriend = currentUser?.friends?.includes(user._id) || false

  const handleCall = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await doCall(user, null, null)
  }

  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation()
    routerPush(router, `/${locale}/conversations?with=${user._id}`, {
      source: 'call_history_message_button',
      targetUserId: user._id,
      targetUserName: user.name
    })
  }

  // Render only action buttons
  if (actionsOnly) {
    return (
      <div className="flex items-center gap-1">
        <IconButton
          onClick={handleMessage}
          className="icon-gradient"
          title={t('sendMessage')}
        >
          <MessageIcon />
        </IconButton>

        <IconButton
          onClick={handleCall}
          className="icon-gradient"
          title={t('call')}
        >
          <CallIcon />
        </IconButton>
      </div>
    )
  }

  return (
    <>
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setDetailsPopupOpen(true)}
      >
        <UserAvatar
          user={user}
          userName={user.name}
          size="md"
        />

        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2">
            <Typography variant="body1" className="text-color truncate">
              {user.name}
            </Typography>
            {isFriend && (
              <Chip
                label={t('friend')}
                size="small"
                color="success"
                variant="outlined"
                className="text-xs"
              />
            )}
          </div>
        </div>

        {!hideActions && (
          <>
            <IconButton
              onClick={handleMessage}
              className="icon-gradient"
              title={t('sendMessage')}
            >
              <MessageIcon />
            </IconButton>

            <IconButton
              onClick={handleCall}
              className="icon-gradient"
              title={t('call')}
            >
              <CallIcon />
            </IconButton>
          </>
        )}
      </div>

      <UserDetailsPopup
        user={user}
        open={detailsPopupOpen}
        onClose={() => setDetailsPopupOpen(false)}
      />
    </>
  )
}
