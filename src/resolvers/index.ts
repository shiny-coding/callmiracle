import { Status } from '@/generated/graphql';
import { Db } from 'mongodb';
import { createPubSub } from 'graphql-yoga';

type ConnectionRequestPayload = {
  onConnectionRequest: {
    offer: string;
    from: {
      userId: string;
      name: string;
      languages: string[];
      statuses: Status[];
    };
  };
  userId: string;
};

type PubSubEvents = {
  [key: string]: [any];
  CONNECTION_REQUEST: [ConnectionRequestPayload];
};

const pubsub = createPubSub<PubSubEvents>();

interface Context {
  db: Db;
}

export const resolvers = {
  Query: {
    users: async (_: any, __: any, { db }: Context) => {
      const users = await db.collection('users').find({
        // Only show users active in the last 15 minutes
        timestamp: { $gt: Date.now() - 15 * 60 * 1000 }
      }).toArray()
      
      return users
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

      return result;
    },
    connectWithUser: async (_: any, { input }: { input: any }, { db }: Context) => {
      const { targetUserId, offer, answer } = input
      const initiatorUserId = input.initiatorUserId || ''

      // Store the connection attempt
      const connection = await db.collection('connections').findOneAndUpdate(
        { 
          $or: [
            { initiatorUserId, targetUserId },
            { initiatorUserId: targetUserId, targetUserId: initiatorUserId }
          ]
        },
        {
          $set: {
            ...(offer && { offer }),
            ...(answer && { answer }),
            timestamp: Date.now()
          }
        },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      )

      if (offer) {
        // Get initiator user details
        const initiator = await db.collection('users').findOne({ userId: initiatorUserId })
        
        if (initiator) {
          // Publish connection request
          const payload: ConnectionRequestPayload = {
            onConnectionRequest: {
              offer,
              from: {
                userId: initiator.userId,
                name: initiator.name,
                languages: initiator.languages,
                statuses: initiator.statuses
              }
            },
            userId: targetUserId
          }
          console.log('Publishing connection request:', {
            targetUserId,
            fromUserId: initiator.userId,
            fromName: initiator.name
          })
          pubsub.publish('CONNECTION_REQUEST', payload)
        }
      }

      return {
        offer: connection?.offer || null,
        answer: connection?.answer || null,
        targetUserId,
        initiatorUserId
      }
    }
  },
  Subscription: {
    onConnectionRequest: {
      subscribe: (_: any, { userId }: { userId: string }) => {
        return pubsub.subscribe('CONNECTION_REQUEST')
      },
      resolve: (payload: ConnectionRequestPayload, { userId }: { userId: string }) => {
        console.log('Resolving connection request:', {
          payloadUserId: payload.userId,
          subscribedUserId: userId,
          willDeliver: payload.userId === userId
        })
        if (payload.userId === userId) {
          return payload.onConnectionRequest
        }
        return null
      }
    }
  }
}; 