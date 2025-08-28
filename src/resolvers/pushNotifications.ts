import webpush from 'web-push'
import { getNotificationMessage } from '@/utils/notificationUtils'
import { Db, ObjectId } from 'mongodb'
import { NotificationType } from '@/generated/graphql'
import { getTranslations } from 'next-intl/server'
import { 
  pushNotificationsSentMetric, 
  pushNotificationsDeliveredMetric, 
  pushNotificationsFailedMetric 
} from '@/utils/metrics'
import { getLogger } from '@/utils/logger'


type PushNotification = {
  type: NotificationType, 
  peerUserName: string, 
  meetingId?: ObjectId,
  messageText?: string,
  senderUserId?: ObjectId
}

// VAPID keys should be generated once and stored securely as environment variables.
// You can generate them using the web-push library:
// npx web-push generate-vapid-keys
const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || ''
}

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT_EMAIL || 'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  )
} else {
  console.warn('VAPID keys are not configured. Push notifications will be disabled.')
}

const sendSinglePushNotification = async (db: Db, userId: ObjectId, subscription: any, payload: any) => {
  const logger = await getLogger()
  if (!subscription || !subscription.endpoint) {
    logger.warn('User does not have a push subscription', {
      userId: userId.toString(),
      hasSubscription: !!subscription,
      hasEndpoint: !!subscription?.endpoint
    })
    return
  }

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.error('VAPID keys are not configured. Cannot send push notification.')
    return
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    pushNotificationsDeliveredMetric.add(1)
    logger.info('Push notification delivered successfully', {
      userId: userId.toString(),
      endpoint: subscription.endpoint,
      payloadType: payload.data?.url ? 'with_url' : 'basic'
    })
  } catch (error: any) {
    pushNotificationsFailedMetric.add(1)
    console.error('📊 Push notification failed:', error)
    // Here you might want to handle expired subscriptions, for example,
    // if error.statusCode is 410, the subscription is gone and should be removed from the database.
    if (error.statusCode === 410) {
      logger.info('Push subscription expired, removing from database', {
        userId: userId.toString(),
        endpoint: subscription.endpoint,
        statusCode: error.statusCode
      })
      await db.collection('users').updateOne(
        { _id: userId },
        { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } } as any
      )
    }
  }
}

export const publishPushNotification = async (db: Db, user: any, notification: PushNotification) => {
  const logger = await getLogger()
  if (!user || !user.pushSubscriptions || !Array.isArray(user.pushSubscriptions) || user.pushSubscriptions.length === 0) {
    logger.info('User not found or has no push subscriptions', {
      userId: user?._id?.toString(),
      hasUser: !!user,
      hasPushSubscriptions: !!user?.pushSubscriptions,
      subscriptionCount: user?.pushSubscriptions?.length || 0,
      notificationType: notification.type
    })
    return
  }

  // Get user's locale, fallback to 'en' if not set
  const userLocale = user.locale || 'en'
  
  // Get translations using next-intl
  const t = await getTranslations({ locale: userLocale })
  
  let body: string
  let url: string

  if (notification.type === NotificationType.MessageReceived) {
    body = `${notification.peerUserName}: ${notification.messageText}`
    url = `/conversations?with=${notification.senderUserId?.toString()}`
  } else {
    body = getNotificationMessage(notification, t)
    url = `/list?meetingId=${notification.meetingId?.toString()}`
  }

  const payload = {
    title: 'CallMiracle',
    body,
    data: {
      url
    }
  }

  logger.info('Sending push notifications to user', {
    userName: user.name,
    userId: user._id.toString(),
    notificationBody: body,
    notificationType: notification.type,
    subscriptionCount: user.pushSubscriptions.length,
    locale: userLocale
  })
  for (const subscription of user.pushSubscriptions) {
    pushNotificationsSentMetric.add(1)
    await sendSinglePushNotification(db, user._id, subscription, payload)
  }
} 