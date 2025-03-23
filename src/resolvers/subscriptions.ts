import { Meeting } from '@/generated/graphql'
import { User } from '@/generated/graphql'
import { pubsub } from './pubsub'

type SubscriptionEventPayload = {
  callEvent: {
    type: 'offer' | 'answer' | 'ice-candidate' | 'finished' | 'updateMediaState'
    offer: string
    answer?: string
    iceCandidate?: string
    videoEnabled?: boolean
    audioEnabled?: boolean
    quality?: string
    from?: User
    callId: string
    userId: string
  }
  notificationEvent: {
    type: 'meeting-connected' | 'meeting-disconnected'
    meeting?: Meeting
    user?: User
  }
  userId: string
}

export type PubSubEvents = {
  [key: string]: [any]
  SUBSCRIPTION_EVENT: [SubscriptionEventPayload]
} 

export const subscriptions = {
  onSubscriptionEvent: {
    subscribe: (_: any, { userId }: { userId: string }) => {
      // Subscribe to user-specific topic
      const topic = `SUBSCRIPTION_EVENT:${userId}`
      console.log('Subscribing to topic:', topic)
      return pubsub.subscribe(topic)
    },
    resolve: (payload: SubscriptionEventPayload) => {
      if ( payload.notificationEvent ) {
        console.log('Resolving meeting changed:', {
          type: payload.notificationEvent.type,
          meetingId: payload.notificationEvent.meeting?._id,
          userName: payload.notificationEvent.user?.name,
          userId: payload.notificationEvent.user?.userId
        })
      } else if ( payload.callEvent ) {
        console.log('Resolving call request:', {
          type: payload.callEvent.type,
          fromUser: payload.callEvent.from?.name,
          toUser: payload.callEvent.userId,
          callId: payload.callEvent.callId
        })
      } else {
        console.log('Resolving unknown event:', payload)
      }
      return payload
    }
  },
} 