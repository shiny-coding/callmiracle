import { pubsub } from './pubsub'
import { transformUser } from './utils'
import { ConnectionRequestPayload, Context } from './types'
import { User } from '@/generated/graphql'

export const subscriptions = {
  onConnectionRequest: {
    subscribe: (_: any, { userId }: { userId: string }) => {
      // Subscribe to user-specific topic
      const topic = `CONNECTION_REQUEST:${userId}`
      console.log('Subscribing to topic:', topic)
      return pubsub.subscribe(topic)
    },
    resolve: (payload: ConnectionRequestPayload) => {
      console.log('Resolving connection request:', {
        type: payload.onConnectionRequest.type,
        fromUser: payload.onConnectionRequest.from?.name,
        toUser: payload.userId,
        callId: payload.onConnectionRequest.callId
      })
      return payload.onConnectionRequest
    }
  },
  onUsersUpdated: {
    subscribe: () => {
      console.log('Subscribing to USERS_UPDATED')
      return pubsub.subscribe('USERS_UPDATED')
    },
    resolve: (payload: User[]) => {
      console.log('Resolving users updated:', {
        length: payload.length
      })
      return payload
    }
  }
} 