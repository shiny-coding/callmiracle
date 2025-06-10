import webpush from 'web-push'

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

export const publishPushNotification = async (subscription: any, payload: any) => {
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
  } catch (error) {
    console.error('Error sending push notification:', error)
    // Here you might want to handle expired subscriptions, for example,
    // if error.statusCode is 410, the subscription is gone and should be removed from the database.
  }
} 