import { Status, User } from '@/generated/graphql';
import { Db } from 'mongodb';
import { createPubSub } from 'graphql-yoga';

type ConnectionRequestPayload = {
  onConnectionRequest: {
    type: 'offer' | 'answer' | 'ice-candidate' | 'finished' | 'changeTracks'
    offer: string
    answer?: string
    iceCandidate?: string
    videoEnabled?: boolean
    audioEnabled?: boolean
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
      const { targetUserId, type, offer, answer, iceCandidate, videoEnabled, audioEnabled } = input
      const initiatorUserId = input.initiatorUserId || ''

      // Store the connection attempt
      const updateQuery = type === 'ice-candidate' 
      ? { $push: { [`iceCandidates.${initiatorUserId}`]: iceCandidate } }
      : { 
          $set: {
            timestamp: Date.now(),
            ...(type === 'offer' && { offer }),
            ...(type === 'answer' && { answer }),
            ...(type === 'finished' && { finished: true }),
            ...(type === 'changeTracks' && { videoEnabled, audioEnabled })
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
      if (!initiator) {
        console.error( 'no user found for initiator', { initiatorUserId })
        return connection
      }

      const targetUser = await db.collection('users').findOne({ userId: targetUserId })
      if (!targetUser) {
        console.error( 'no user found for target', { targetUserId })
        return connection
      }
      
      console.log('connectWithUser:', { type, targetName: targetUser.name, initiatorName: initiator.name })


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
        finished: { offer: '' },
        changeTracks: { videoEnabled, audioEnabled }
      }

      // Create a unique topic for this user's connection requests
      const topic = `CONNECTION_REQUEST:${targetUserId}`
      
      pubsub.publish(topic, {
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
        // Subscribe to user-specific topic
        const topic = `CONNECTION_REQUEST:${userId}`
        return pubsub.subscribe(topic)
      },
      resolve: (payload: ConnectionRequestPayload) => {
        console.log('Resolving connection request:', {
          type: payload.onConnectionRequest.type,
          fromUser: payload.onConnectionRequest.from.name,
          toUser: payload.userId
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