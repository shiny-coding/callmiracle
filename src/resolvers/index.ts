import { Status, User } from '@/generated/graphql';
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
        users: typedUsers
      })

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
        const target = await db.collection('users').findOne({ userId: targetUserId })
        
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
            targetName: target?.name || 'Unknown',
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
      resolve: async (payload: ConnectionRequestPayload, { userId }: { userId: string }, { db }: Context) => {
        // Get user names for logging
        const subscribedUser = await db.collection('users').findOne({ userId })
        const payloadUser = await db.collection('users').findOne({ userId: payload.userId })
        
        console.log('Resolving connection request:', {
          payloadUserId: payload.userId,
          payloadUserName: payloadUser?.name || 'Unknown',
          subscribedUserId: userId,
          subscribedUserName: subscribedUser?.name || 'Unknown',
          willDeliver: payload.userId === userId
        })
        if (payload.userId === userId) {
          return payload.onConnectionRequest
        }
        return null
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