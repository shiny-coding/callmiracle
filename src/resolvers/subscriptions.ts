import { BroadcastEvent, CallEvent, Meeting, NotificationEvent, NotificationType } from '@/generated/graphql'
import { pubsub } from '@/lib/pubsub'
import { mergeAsyncIterators } from '@/utils'
import { getLogger, withContext } from '@/utils/logger'
import { ObjectId } from 'mongodb'

export type SubscriptionEventPayload = {
  logger: ReturnType<typeof withContext>
  subscriberUserId?: string
  subscriberUserName?: string
} & (
  | { callEvent: CallEvent; notificationEvent?: never; broadcastEvent?: never }
  | { notificationEvent: NotificationEvent; callEvent?: never; broadcastEvent?: never }
  | { broadcastEvent: BroadcastEvent; callEvent?: never; notificationEvent?: never }
)

export type PubSubEvents = {
  [key: string]: [any]
  SUBSCRIPTION_EVENT: [SubscriptionEventPayload]
} 

export const subscriptions = {
  onSubscriptionEvent: {
    subscribe: async (_: any, { userId }: { userId: string }, { db }: { db: any }) => {
      const logger = await getLogger()
      
      // Get subscriber user info
      const subscriberUser = await db.collection('users').findOne({ _id: new ObjectId(userId) })
      const subscriberUserName = subscriberUser?.name || 'Unknown User'
      
      // Subscribe to user-specific topic
      const userTopic = `SUBSCRIPTION_EVENT:${userId}`
      const globalTopic = `SUBSCRIPTION_EVENT:ALL`
      
      logger.info('User subscribing to real-time events', {
        userId,
        subscriberUserName,
        userTopic,
        globalTopic,
      })
      
      // Create async iterators for both topics
      const userIterator = pubsub.asyncIterator(userTopic)
      const globalIterator = pubsub.asyncIterator(globalTopic)
      
      // Create a wrapper that adds subscriber context to each payload
      const addSubscriberContext = (iterator: AsyncIterable<any>) => ({
        [Symbol.asyncIterator]: async function* () {
          for await (const payload of iterator) {
            yield {
              ...payload,
              subscriberUserId: userId,
              subscriberUserName
            }
          }
        }
      })
      
      const userIteratorWithContext = addSubscriberContext(userIterator)
      const globalIteratorWithContext = addSubscriberContext(globalIterator)
      
      return mergeAsyncIterators([userIteratorWithContext, globalIteratorWithContext])
    },
    resolve: async (payload: SubscriptionEventPayload) => {
      // Recreate logger from serialized context (functions don't survive Redis serialization)
      const logger = payload.logger.context ? withContext(payload.logger.context) : withContext({
        requestId: 'subscription-fallback',
        path: '/graphql/subscription', 
        userAgent: 'GraphQL-Subscription',
        ip: 'internal',
        userId: 'system',
        userName: 'System'
      })
      if ( payload.notificationEvent ) {
        if (payload.notificationEvent.type === NotificationType.MessageReceived) {
          logger.info('Resolving message notification event', {
            notificationType: payload.notificationEvent.type,
            senderName: payload.notificationEvent.peerUserName,
            senderId: payload.notificationEvent.peerUserId?.toString(),
            messageLength: payload.notificationEvent.messageText?.length,
            conversationId: payload.notificationEvent.conversationId?.toString(),
            subscriberUserId: payload.subscriberUserId,
            subscriberUserName: payload.subscriberUserName
          })
        } else {
          logger.info('Resolving meeting notification event', {
            notificationType: payload.notificationEvent.type,
            meetingId: payload.notificationEvent.meeting?._id?.toString(),
            peerUserName: payload.notificationEvent.peerUserName,
            peerUserId: payload.notificationEvent.peerUserId?.toString(),
            subscriberUserId: payload.subscriberUserId,
            subscriberUserName: payload.subscriberUserName
          })
        }
      } else if ( payload.callEvent ) {
        logger.info('Resolving call event', {
          callType: payload.callEvent.type,
          fromUserName: payload.callEvent.from?.name,
          fromUserId: payload.callEvent.from?._id?.toString(),
          targetUserId: payload.callEvent.userId?.toString(),
          callId: payload.callEvent.callId?.toString(),
          meetingId: payload.callEvent.meetingId?.toString(),
          subscriberUserId: payload.subscriberUserId,
          subscriberUserName: payload.subscriberUserName
        })
      } else if ( payload.broadcastEvent ) {
        logger.info('Resolving broadcast event for subscriber', {
          broadcastType: payload.broadcastEvent.type,
          subscriberUserId: payload.subscriberUserId,
          subscriberUserName: payload.subscriberUserName
        })
      } else {
        logger.warn('Resolving unknown subscription event', {
          payloadKeys: Object.keys(payload)
        })
      }
      return payload
    }
  },
} 