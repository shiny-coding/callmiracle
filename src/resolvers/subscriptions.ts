import { BroadcastEvent, CallEvent, Meeting, NotificationEvent, NotificationType } from '@/generated/graphql'
import { pubsub } from '@/lib/pubsub'
import { addActiveSubscription, removeActiveSubscription } from '@/lib/activeSubscriptions'
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
        subscriberUserName,
        userTopic,
        globalTopic,
      })

      // Track active subscription for this user
      addActiveSubscription(userId)

      // Create async iterators for both topics
      // Note: PubSub (graphql-subscriptions) uses asyncIterableIterator
      //       RedisPubSub (graphql-redis-subscriptions) uses asyncIterator
      const asyncIteratorMethod = (pubsub as any).asyncIterableIterator || (pubsub as any).asyncIterator

      if (!asyncIteratorMethod) {
        logger.error('PubSub does not have asyncIterableIterator or asyncIterator method')
        throw new Error('PubSub not properly initialized')
      }

      const userIterator = asyncIteratorMethod.call(pubsub, userTopic)
      const globalIterator = asyncIteratorMethod.call(pubsub, globalTopic)
      
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

      const mergedIterator = mergeAsyncIterators([userIteratorWithContext, globalIteratorWithContext])

      // Wrap with cleanup to decrement listener count
      return {
        [Symbol.asyncIterator]() {
          const iterator = mergedIterator[Symbol.asyncIterator]()
          return {
            next: () => iterator.next(),
            return: async () => {
              logger.info('User unsubscribed from real-time events', {
                subscriberUserName
              })

              // Remove active subscription tracking for this user
              removeActiveSubscription(userId)

              // Cleanup both iterators
              if (userIterator.return) await userIterator.return()
              if (globalIterator.return) await globalIterator.return()

              return { done: true, value: undefined }
            },
            throw: (error: any) => iterator.throw?.(error) || Promise.reject(error)
          }
        }
      }
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
        // Not logging broadcast events because of the large number of subscribers
      } else {
        logger.warn('Resolving unknown subscription event', {
          payloadKeys: Object.keys(payload)
        })
      }
      return payload
    }
  },
} 