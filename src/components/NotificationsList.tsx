import React from 'react'
import { Paper, List, ListItem, Typography, IconButton, Button, Badge, Chip, Box } from '@mui/material'
import { useTranslations, useLocale } from 'next-intl'
import { useNotifications } from '@/contexts/NotificationsContext'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import CheckIcon from '@mui/icons-material/Check'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { useMeetings } from '@/contexts/MeetingsContext'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import { NotificationType } from '@/generated/graphql'
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
  
  if (loading && notifications.length === 0) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading notifications</Typography>

  const getNotificationMessage = (notification: any) => {
    switch (notification.type) {
      case NotificationType.MeetingConnected:
        return t('notificationMessages.meetingConnected')
      case NotificationType.MeetingDisconnected:
        return t('notificationMessages.meetingDisconnected')
      case NotificationType.MeetingFinished:
        return t('notificationMessages.meetingWithFinished', { name: notification.peerUserName })
      default:
        console.log('Unknown notification type:', notification.type)
        return t('notificationMessages.newNotification')
    }
  }

  const handleGoToMeeting = (notification: any) => {
    setNotificationSeen(notification._id)
    setHighlightedMeetingId(notification.meetingId)
    onClose?.()
  }

  return (
    <Paper className="p-4 bg-gray-800">
      {notifications.length > 0 && (
        <Box className="flex justify-end mb-3">
          <Button
            size="small"
            variant="outlined"
            startIcon={<DoneAllIcon />}
            onClick={setAllNotificationsSeen}
            disabled={markingAllSeen || !hasUnseenNotifications}
            className="text-xs"
          >
            {t('markAllAsSeen')}
          </Button>
        </Box>
      )}
      
      <List>
        {notifications.length === 0 ? (
          <Typography className="text-gray-400 text-center py-4">
            {t('noNotifications')}
          </Typography>
        ) : (
          notifications.map((notification: any) => (
            <ListItem 
              key={notification._id} 
              className={`flex flex-col p-4 ${notification.seen ? 'bg-gray-700' : 'bg-gray-600'} rounded-lg mb-2`}
            >
              <div className="w-full">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    {!notification.seen && (
                      <Badge color="primary" variant="dot" className="mr-2" />
                    )}
                    <Typography variant="subtitle1">
                      {getNotificationMessage(notification)}
                    </Typography>
                  </div>
                  <Chip 
                    size="small" 
                    label={formatRelativeTime(notification.createdAt)} 
                    className="text-xs bg-gray-500"
                  />
                </div>
                
                <div className="flex mt-3 gap-2">
                  {!notification.seen && (
                    <Button 
                      size="small" 
                      variant="outlined"
                      startIcon={<CheckIcon />}
                      onClick={() => setNotificationSeen(notification._id)}
                      className="text-xs"
                    >
                      {t('markAsSeen')}
                    </Button>
                  )}
                  
                  {(notification.type === NotificationType.MeetingConnected || notification.type === NotificationType.MeetingDisconnected) && 
                    notification.meeting && (
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
                  )}
                </div>
              </div>
            </ListItem>
          ))
        )}
      </List>
    </Paper>
  )
} 