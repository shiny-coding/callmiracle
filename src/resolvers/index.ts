import { Status, User } from '@/generated/graphql';
import { Db } from 'mongodb';
import { createPubSub } from 'graphql-yoga';

type ConnectionRequestPayload = {
  onConnectionRequest: {
    type: 'offer' | 'answer' | 'ice-candidate' | 'finished'
    offer: string
    answer?: string
    iceCandidate?: string
    from: {
      userId: string
      name: string
      languages: string[]
      statuses: Status[]
    }
  }
  userId: string
}

type PubSubEvents = {
  [key: string]: [any];
  CONNECTION_REQUEST: [ConnectionRequestPayload];
  USERS_UPDATED: [User[]];
};

const pubsub = createPubSub<PubSubEvents>();

interface Context {
  db: Db;
}

export const resolvers = {
  Query: {
    users: async (_: any, __: any, { db }: Context) => {
      const users = await db.collection('users').find({
        // Only show users active in the last 1500 minutes
        timestamp: { $gt: Date.now() - 1500 * 60 * 1000 }
      }).toArray()
      
      // Map MongoDB documents to User type
      return users.map(user => ({
        userId: user.userId,
        name: user.name,
        statuses: user.statuses,
        languages: user.languages,
        timestamp: user.timestamp,
        locale: user.locale
      }))
    }
  },
  Mutation: {
    connect: async (_: any, { input }: { input: any }, { db }: Context) => {
      const { userId, name, statuses, locale, languages } = input;
      const timestamp = Date.now();

      const result = await db.collection('users').findOneAndUpdate(
        { userId },
        { 
          $set: { 
            name, 
            statuses, 
            timestamp,
            locale,
            languages
          } 
        },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      );

      // Get updated user list and publish
      const users = await db.collection('users').find({
        timestamp: { $gt: Date.now() - 1500 * 60 * 1000 }
      }).toArray();
      
      // Map MongoDB documents to User type
      const typedUsers = users.map(user => ({
        userId: user.userId,
        name: user.name,
        statuses: user.statuses,
        languages: user.languages,
        timestamp: user.timestamp,
        locale: user.locale
      }));
      
      pubsub.publish('USERS_UPDATED', typedUsers);

      console.log('Publishing users updated:', {
        users: typedUsers.length
      })

      return result;
    },
    connectWithUser: async (_: any, { input }: { input: any }, { db }: Context) => {
      const { targetUserId, type, offer, answer, iceCandidate } = input
      const initiatorUserId = input.initiatorUserId || ''

      console.log('Handling connectWithUser:', { type, targetUserId, initiatorUserId })

      // Store the connection attempt
      const updateQuery = type === 'ice-candidate' 
        ? { $push: { [`iceCandidates.${initiatorUserId}`]: iceCandidate } }
        : { 
            $set: {
              timestamp: Date.now(),
              ...(type === 'offer' && { offer }),
              ...(type === 'answer' && { answer }),
              ...(type === 'finished' && { finished: true })
            }
          }

      const connection = await db.collection('connections').findOneAndUpdate(
        { $or: [
            { initiatorUserId, targetUserId },
            { initiatorUserId: targetUserId, targetUserId: initiatorUserId }
          ]
        },
        updateQuery,
        { upsert: true, returnDocument: 'after' }
      )

      // Get user info for publishing
      const initiator = await db.collection('users').findOne({ userId: initiatorUserId })
      if (!initiator) return connection

      // Prepare common payload data
      const basePayload = {
        onConnectionRequest: {
          type,
          offer: '',  // Default empty offer
          from: {
            userId: initiator.userId,
            name: initiator.name,
            languages: initiator.languages,
            statuses: initiator.statuses
          }
        },
        userId: targetUserId
      }

      // Additional fields based on type
      const additionalFields: Record<string, Record<string, any>> = {
        offer: { offer },
        answer: { offer: connection?.offer, answer },
        'ice-candidate': { offer: connection?.offer, iceCandidate },
        finished: { offer: '' }
      }

      pubsub.publish('CONNECTION_REQUEST', {
        ...basePayload,
        onConnectionRequest: {
          ...basePayload.onConnectionRequest,
          ...additionalFields[type]
        }
      })

      return {
        type,
        offer: connection?.offer || null,
        answer: connection?.answer || null,
        iceCandidate: connection?.iceCandidate || null,
        targetUserId,
        initiatorUserId
      }
    }
  },
  Subscription: {
    onConnectionRequest: {
      subscribe: (_: any, { userId }: { userId: string }) => {
        const iterator = pubsub.subscribe('CONNECTION_REQUEST')
        return {
          async *[Symbol.asyncIterator]() {
            for await (const payload of iterator) {
              if (payload.userId === userId) {
                yield payload
              }
            }
          }
        }
      },
      resolve: (payload: ConnectionRequestPayload) => {
        console.log('Resolving connection request:', {
          type: payload.onConnectionRequest.type,
          hasOffer: !!payload.onConnectionRequest.offer,
          hasIceCandidate: !!payload.onConnectionRequest.iceCandidate,
          fromUser: payload.onConnectionRequest.from.name
        })
        return payload.onConnectionRequest
      }
    },
    onUsersUpdated: {
      subscribe: () => pubsub.subscribe('USERS_UPDATED'),
      resolve: (payload: User[]) => {
        console.log('Resolving users updated:', {
          length: payload.length
        })
        return payload
      }
    }
  }
}; 