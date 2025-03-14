import { Db } from 'mongodb'
import { Meeting, User } from '@/generated/graphql'

export interface Context {
  db: Db
}

export type ConnectionRequestPayload = {
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
  CONNECTION_REQUEST: [ConnectionRequestPayload]
  USERS_UPDATED: [User[]]
} 