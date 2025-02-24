import { Db } from 'mongodb'
import { User } from '@/generated/graphql'

export interface Context {
  db: Db
}

export type ConnectionRequestPayload = {
  onConnectionRequest: {
    type: 'offer' | 'answer' | 'ice-candidate' | 'finished' | 'updateMediaState'
    offer: string
    answer?: string
    iceCandidate?: string
    videoEnabled?: boolean
    audioEnabled?: boolean
    quality?: string
    from?: User
    callId: string
  }
  userId: string
}

export type PubSubEvents = {
  [key: string]: [any]
  CONNECTION_REQUEST: [ConnectionRequestPayload]
  USERS_UPDATED: [User[]]
} 