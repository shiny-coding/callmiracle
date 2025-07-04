import { ObjectId } from 'mongodb'
import { NotificationType } from '@/generated/graphql';
import { pubsub } from './pubsub';
import { publishPushNotification } from './pushNotifications';


// Helper function to publish meeting disconnection notification
export async function publishMeetingNotification(notificationType: NotificationType, db: any, peerMeeting: any, meeting: any) {
  
  // Get the peer user for notification
  const peerUser = await db.collection('users').findOne({ _id: peerMeeting.userId })
  
  if (!peerUser) {
    console.error('Peer user not found', { peerMeeting, meeting })
    return
  }
  
  // Create a notification in the database
  await db.collection('notifications').insertOne({
    userId: peerUser._id,
    userName: peerUser.name,
    type: notificationType,
    seen: false,
    meetingId: peerMeeting._id,
    createdAt: new Date()
  })
  
  // Publish notification event
  const topic = `SUBSCRIPTION_EVENT:${peerMeeting.userId.toString()}`
  pubsub.publish(topic, { notificationEvent: { type: notificationType, meeting: peerMeeting, user: peerUser, peerUserName: meeting.userName } })
  
  console.log(`Published ${notificationType} event for peer:`, { name: peerUser.name, userId: peerMeeting.userId.toString() })

  await publishPushNotification(db, peerUser, {
    type: notificationType,
    peerUserName: meeting.userName,
    meetingId: peerMeeting._id
  })
}

// Helper function to publish message notification (no DB storage, just real-time notification)
export async function publishMessageNotification(db: any, targetUserId: ObjectId, senderUser: any, messageText: string, conversationId: ObjectId) {
  
  // Get the target user for notification
  const targetUser = await db.collection('users').findOne({ _id: targetUserId })
  
  if (!targetUser) {
    console.error('Target user not found', { targetUserId })
    return
  }

  // Publish notification event (no DB storage)
  const topic = `SUBSCRIPTION_EVENT:${targetUserId.toString()}`
  pubsub.publish(topic, { 
    notificationEvent: { 
      type: NotificationType.MessageReceived, 
      peerUserId: senderUser._id.toString(),
      peerUserName: senderUser.name,
      messageText: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
      conversationId: conversationId.toString()
    }
  })
  
  console.log(`Published MESSAGE_RECEIVED event for user:`, { name: targetUser.name, userId: targetUserId.toString() })
}
