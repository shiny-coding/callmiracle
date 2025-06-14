import webpush from 'web-push'
import { getNotificationMessage } from '@/utils/notificationUtils'
import { Db, ObjectId } from 'mongodb'
import { NotificationType } from '@/generated/graphql'
import { getTranslations } from 'next-intl/server'

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
  if (!subscription || !subscription.endpoint) {
    console.log('User does not have a push subscription.')
    return
  }

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.error('VAPID keys are not configured. Cannot send push notification.')
    return
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    console.log('Push notification sent successfully.')
  } catch (error: any) {
    console.error('Error sending push notification:', error)
    // Here you might want to handle expired subscriptions, for example,
    // if error.statusCode is 410, the subscription is gone and should be removed from the database.
    if (error.statusCode === 410) {
      console.log('Subscription has expired or is no longer valid, removing from DB.')
      await db.collection('users').updateOne(
        { _id: userId },
        { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } } as any
      )
    }
  }
}

export const publishPushNotification = async (db: Db, user: any, notification: { type: NotificationType, peerUserName: string, meetingId: ObjectId }) => {
  if (!user || !user.pushSubscriptions || !Array.isArray(user.pushSubscriptions) || user.pushSubscriptions.length === 0) {
    console.log(`User ${user?._id} not found or has no push subscriptions.`)
    return
  }

  // Get user's locale, fallback to 'en' if not set
  const userLocale = user.locale || 'en'
  
  // Get translations using next-intl
  const t = await getTranslations({ locale: userLocale })
  
  const body = getNotificationMessage(notification, t)

  const payload = {
    title: 'CallMiracle',
    body,
    data: {
      url: `/list?meetingId=${notification.meetingId.toString()}`
    }
  }

  console.log('Sending push notifications to user:', user.name + " (" + user._id.toString() + ")", body)
  for (const subscription of user.pushSubscriptions) {
    await sendSinglePushNotification(db, user._id, subscription, payload)
  }
} 