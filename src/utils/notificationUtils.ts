import { NotificationType } from '@/generated/graphql'

type TFunction = (key: string, values?: Record<string, any>) => string

export const getNotificationMessage = (notification: any, t: TFunction): string => {
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