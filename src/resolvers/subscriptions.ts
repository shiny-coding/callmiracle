import { BroadcastEvent, CallEvent, Meeting, NotificationEvent, NotificationType } from '@/generated/graphql'
import { pubsub } from './pubsub'
import { mergeAsyncIterators } from '@/utils'

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
    subscribe: (_: any, { userId }: { userId: string }) => {
      // Subscribe to user-specific topic
      const userTopic = `SUBSCRIPTION_EVENT:${userId}`
      const globalTopic = `SUBSCRIPTION_EVENT:ALL`
      console.log('Subscribing to topics:', userTopic, globalTopic)
      return mergeAsyncIterators([
        pubsub.subscribe(userTopic),
        pubsub.subscribe(globalTopic)
      ])
    },
    resolve: (payload: SubscriptionEventPayload) => {
      if ( payload.notificationEvent ) {
        if (payload.notificationEvent.type === NotificationType.MessageReceived) {
          console.log('Resolving message notification:', {
            type: payload.notificationEvent.type,
            senderName: payload.notificationEvent.peerUserName,
            senderId: payload.notificationEvent.peerUserId,
            messageText: payload.notificationEvent.messageText
          })
        } else {
          console.log('Resolving meeting notification:', {
            type: payload.notificationEvent.type,
            meetingId: payload.notificationEvent.meeting?._id,
            userName: payload.notificationEvent.peerUserName,
            userId: payload.notificationEvent.peerUserId
          })
        }
      } else if ( payload.callEvent ) {
        console.log('Resolving call request:', {
          type: payload.callEvent.type,
          fromUser: payload.callEvent.from?.name,
          toUser: payload.callEvent.userId,
          callId: payload.callEvent.callId
        })
      } else if ( payload.broadcastEvent ) {
        console.log('Resolving broadcast event:', {
          type: payload.broadcastEvent.type
        })
      } else {
        console.log('Resolving unknown event:', payload)
      }
      return payload
    }
  },
} 