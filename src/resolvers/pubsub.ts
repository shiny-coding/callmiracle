import { createPubSub } from 'graphql-yoga'
import { PubSubEvents } from './subscriptions'

export const pubsub = createPubSub<PubSubEvents>() 