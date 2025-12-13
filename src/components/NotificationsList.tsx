import React from 'react'
import { Paper, List, ListItem, Typography, IconButton, Button, Badge, Chip, Box } from '@mui/material'
import { useTranslations, useLocale } from 'next-intl'
import { useNotifications } from '@/contexts/NotificationsContext'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import CallIcon from '@mui/icons-material/Call'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { useMeetings } from '@/contexts/MeetingsContext'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import { NotificationType } from '@/generated/graphql'
import { useRouter } from 'next/navigation'
import { getNotificationMessage } from '@/utils/notificationUtils'
import { routerPush } from '@/utils/routerHelper'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CloseIcon from '@mui/icons-material/Close'
import PageHeader from './PageHeader'
import LoadingDialog from './LoadingDialog'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import UserAvatar from './UserAvatar'

interface NotificationsListProps {
  onClose?: () => void
}

export default function NotificationsList({ onClose }: NotificationsListProps) {
  const { 
    notifications, 
    loading, 
    error, 
    setNotificationSeen, 
    setAllNotificationsSeen, 
    markingAllSeen,
    hasUnseenNotifications 
  } = useNotifications()
  
  const t = useTranslations()
  const { setHighlightedMeetingId } = useMeetings()
  const router = useRouter()
  const { doCall } = useWebRTCContext()

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  const handleGoToMeeting = (notification: any) => {
    setNotificationSeen(notification._id)
    setHighlightedMeetingId(notification.meetingId)
    onClose?.()
    routerPush(router, `/list`, {
      source: 'notification_go_to_meeting',
      notificationType: notification.type,
      meetingId: notification.meetingId,
      notificationId: notification._id
    })
  }

  const handleCallback = async (notification: any) => {
    if (notification.peerUser) {
      setNotificationSeen(notification._id)
      onClose?.()
      await doCall(notification.peerUser, notification.meetingId, null)
    }
  }

  const handleMarkAllAsSeen = () => {
    setAllNotificationsSeen()
    handleClose()
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
    } else {
      // Check if there's history to go back to, otherwise go to calendar
      if (window.history.length > 1) {
        router.back()
      } else {
        routerPush(router, '/calendar', { source: 'notifications_close_fallback' })
      }
    }
  }

  return (
    <Paper className=" flex flex-col h-full">
      <PageHeader
        icon={<NotificationsIcon className="dimmer-text-color" />}
        title={t('notifications')}
      >
        <IconButton
          onClick={handleClose}
          aria-label={t('close')}
          title={t('close')}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </PageHeader>

      <div className="flex-grow overflow-y-auto px-12sp" style={{ paddingTop: 'var(--list-item-gap)', paddingBottom: 'var(--list-item-gap)' }}>
        <List>
          {notifications.length === 0 ? (
            <Typography className="text-gray-400 text-center py-4">
              {t('noNotifications')}
            </Typography>
          ) : (
            notifications.map((notification: any) => {
              const isMissedCall = notification.type === NotificationType.MissedCall
              const hasPeerUser = !!notification.peerUser

              return (
                <ListItem
                  key={notification._id}
                  className="flex flex-col p-4 card-bg rounded-lg mb-2"
                >
                  <div className="w-full">
                    {/* For missed calls with peerUser: show avatar + name on first line */}
                    {isMissedCall && hasPeerUser ? (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-3">
                            {!notification.seen && (
                              <Badge color="primary" variant="dot" />
                            )}
                            <UserAvatar
                              user={notification.peerUser}
                              userName={notification.peerUserName}
                              size="md"
                            />
                            <Typography variant="subtitle1">
                              {notification.peerUserName}
                            </Typography>
                          </div>
                          <Chip
                            size="small"
                            label={formatRelativeTime(notification.createdAt)}
                            className="!text-xs bg-gray-500 !ml-2"
                          />
                        </div>
                        <Typography variant="subtitle1" className="dimmer-text-color">
                          {t('notificationMessages.missedCallTitle')}
                        </Typography>
                      </>
                    ) : (
                      /* Default layout for other notifications */
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          {hasPeerUser && (
                            <UserAvatar
                              user={notification.peerUser}
                              userName={notification.peerUserName}
                              size="md"
                            />
                          )}
                          <div className="flex items-center">
                            {!notification.seen && (
                              <Badge color="primary" variant="dot" className="mr-4" />
                            )}
                            <Typography variant="subtitle1">
                              {getNotificationMessage(notification, t)}
                            </Typography>
                          </div>
                        </div>
                        <Chip
                          size="small"
                          label={formatRelativeTime(notification.createdAt)}
                          className="!text-xs bg-gray-500 !ml-2"
                        />
                      </div>
                    )}

                    {(notification.type === NotificationType.MeetingConnected || notification.type === NotificationType.MeetingDisconnected) &&
                      notification.meeting && (
                      <div className="flex mt-3 gap-2">
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          startIcon={<ArrowRightIcon />}
                          className="text-xs"
                          onClick={() => handleGoToMeeting(notification)}
                        >
                          {t('goToMeeting')}
                        </Button>
                      </div>
                    )}

                    {isMissedCall && hasPeerUser && (
                      <div className="flex mt-3 gap-2">
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CallIcon sx={{ color: 'white' }} />}
                          className="text-xs"
                          onClick={() => handleCallback(notification)}
                        >
                          {t('callback')}
                        </Button>
                      </div>
                    )}
                  </div>
                </ListItem>
              )
            })
          )}
        </List>
      </div>

      {notifications.length > 0 && (
        <Box className="px-4 py-3 flex justify-center" style={{ borderTop: '1px solid var(--border-color)' }}>
          <Button
            variant="outlined"
            startIcon={<DoneAllIcon />}
            onClick={handleMarkAllAsSeen}
            disabled={markingAllSeen || !hasUnseenNotifications}
            sx={{ maxWidth: 420, px: 4 }}
          >
            {t('markAllAsSeen')}
          </Button>
        </Box>
      )}
    </Paper>
  )
} 