import { ObjectId } from 'mongodb'
import { NotificationType } from '@/generated/graphql';
import { publishPushNotification } from './pushNotifications';
import { getLogger } from '@/utils/logger';
import { publishSubscriptionEvent } from '@/utils/pubsubHelper';
import { hasActiveSubscription } from '@/lib/activeSubscriptions';


// Helper function to publish meeting disconnection notification
export async function publishMeetingNotification(notificationType: NotificationType, db: any, peerMeeting: any, meeting: any) {
  const logger = await getLogger()
  
  // Get the peer user for notification
  const peerUser = await db.collection('users').findOne({ _id: peerMeeting.userId })
  
  if (!peerUser) {
    console.error('Peer user not found', { peerMeeting, meeting })
    return
  }
  
  // Create a notification in the database
  const notificationResult = await db.collection('notifications').insertOne({
    userId: peerUser._id,
    userName: peerUser.name,
    type: notificationType,
    seen: false,
    meetingId: peerMeeting._id,
    createdAt: new Date()
  })

  const notificationId = notificationResult.insertedId

  // Publish notification event
  const topic = `SUBSCRIPTION_EVENT:${peerMeeting.userId.toString()}`
  publishSubscriptionEvent(topic, {
    notificationEvent: { type: notificationType as NotificationType, meeting: peerMeeting, peerUserName: meeting.userName },
    logger
  })

  logger.info('Published meeting notification event', {
    notificationType,
    peerUserName: peerUser.name,
    peerUserId: peerMeeting.userId.toString(),
    meetingId: peerMeeting._id.toString(),
    initiatorUserName: meeting.userName,
    notificationId: notificationId.toString()
  })

  await publishPushNotification(db, peerUser, {
    type: notificationType,
    peerUserName: meeting.userName,
    meetingId: peerMeeting._id,
    notificationId
  })
}

// Helper function to publish message notification (no DB storage, just real-time notification)
export async function publishMessageNotification(db: any, targetUserId: ObjectId, senderUser: any, messageText: string, conversationId: ObjectId) {
  const logger = await getLogger()
  
  // Get the target user for notification
  const targetUser = await db.collection('users').findOne({ _id: targetUserId })
  
  if (!targetUser) {
    console.error('Target user not found', { targetUserId })
    return
  }

  // Publish notification event (no DB storage)
  const topic = `SUBSCRIPTION_EVENT:${targetUserId.toString()}`
  publishSubscriptionEvent(topic, { 
    notificationEvent: { 
      type: NotificationType.MessageReceived, 
      peerUserId: senderUser._id.toString(),
      peerUserName: senderUser.name,
      messageText: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
      conversationId: conversationId.toString()
    },
    logger
  })
  
  // Check if target user has an active subscription (app is open)
  const userHasActiveSubscription = hasActiveSubscription(targetUserId.toString())

  logger.info('Published message notification event', {
    targetUserName: targetUser.name,
    targetUserId: targetUserId.toString(),
    senderUserName: senderUser.name,
    senderId: senderUser._id.toString(),
    messageLength: messageText.length,
    conversationId: conversationId.toString(),
    userHasActiveSubscription
  })

  // Only send push notification if user doesn't have an active subscription
  // If they're connected, they'll receive the real-time event instead
  if (!userHasActiveSubscription) {
    await publishPushNotification(db, targetUser, {
      type: NotificationType.MessageReceived,
      peerUserName: senderUser.name,
      messageText: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
      senderUserId: senderUser._id
    })
  } else {
    logger.info('Skipping push notification - user has active subscription', {
      targetUserName: targetUser.name,
      targetUserId: targetUserId.toString()
    })
  }
}
