import { BroadcastEvent, CallEvent, Meeting, NotificationEvent, NotificationType } from '@/generated/graphql'
import { pubsub } from '@/lib/pubsub'
import { mergeAsyncIterators } from '@/utils'
import { getLogger } from '@/utils/logger'

export type SubscriptionEventPayload = {
  callEvent: CallEvent
  notificationEvent: NotificationEvent
  broadcastEvent: BroadcastEvent
}

export type PubSubEvents = {
  [key: string]: [any]
  SUBSCRIPTION_EVENT: [SubscriptionEventPayload]
} 

export const subscriptions = {
  onSubscriptionEvent: {
    subscribe: async (_: any, { userId }: { userId: string }) => {
      const logger = await getLogger()
      // Subscribe to user-specific topic
      const userTopic = `SUBSCRIPTION_EVENT:${userId}`
      const globalTopic = `SUBSCRIPTION_EVENT:ALL`
      logger.info('User subscribing to real-time events', {
        userId,
        userTopic,
        globalTopic
      })
      
      // Create async iterators for both topics
      const userIterator = pubsub.asyncIterator(userTopic)
      const globalIterator = pubsub.asyncIterator(globalTopic)
      
      return mergeAsyncIterators([userIterator, globalIterator])
    },
    resolve: async (payload: SubscriptionEventPayload) => {
      const logger = await getLogger()
      if ( payload.notificationEvent ) {
        if (payload.notificationEvent.type === NotificationType.MessageReceived) {
          logger.info('Resolving message notification event', {
            notificationType: payload.notificationEvent.type,
            senderName: payload.notificationEvent.peerUserName,
            senderId: payload.notificationEvent.peerUserId?.toString(),
            messageLength: payload.notificationEvent.messageText?.length,
            conversationId: payload.notificationEvent.conversationId?.toString()
          })
        } else {
          logger.info('Resolving meeting notification event', {
            notificationType: payload.notificationEvent.type,
            meetingId: payload.notificationEvent.meeting?._id?.toString(),
            peerUserName: payload.notificationEvent.peerUserName,
            peerUserId: payload.notificationEvent.peerUserId?.toString()
          })
        }
      } else if ( payload.callEvent ) {
        logger.info('Resolving call event', {
          callType: payload.callEvent.type,
          fromUserName: payload.callEvent.from?.name,
          fromUserId: payload.callEvent.from?._id?.toString(),
          targetUserId: payload.callEvent.userId?.toString(),
          callId: payload.callEvent.callId?.toString(),
          meetingId: payload.callEvent.meetingId?.toString()
        })
      } else if ( payload.broadcastEvent ) {
        logger.info('Resolving broadcast event', {
          broadcastType: payload.broadcastEvent.type
        })
      } else {
        logger.warn('Resolving unknown subscription event', {
          hasNotificationEvent: !!payload.notificationEvent,
          hasCallEvent: !!payload.callEvent,
          hasBroadcastEvent: !!payload.broadcastEvent,
          payloadKeys: Object.keys(payload)
        })
      }
      return payload
    }
  },
} 