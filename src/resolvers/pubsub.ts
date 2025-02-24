import { createPubSub } from 'graphql-yoga'
import { PubSubEvents } from './types'

export const pubsub = createPubSub<PubSubEvents>() 