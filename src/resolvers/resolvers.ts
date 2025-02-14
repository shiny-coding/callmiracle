import { Status, User } from '@/generated/graphql';
import { Db } from 'mongodb';
import { createPubSub } from 'graphql-yoga';
import { ObjectId } from 'mongodb';
import { existsSync } from 'fs';
import { join } from 'path';

// Helper function to check if user has profile image
const checkUserImage = (userId: string): boolean => {
  const imagePath = join(process.cwd(), 'public', 'profiles', `${userId}.jpg`);
  return existsSync(imagePath);
};

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
    callId: string
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
      const users = await db.collection('users').find().toArray()
      
      // Map MongoDB documents to User type
      return users.map(user => ({
        userId: user.userId,
        name: user.name,
        statuses: user.statuses || [],
        languages: user.languages || [],
        timestamp: user.timestamp,
        locale: user.locale,
        online: user.online || false,
        hasImage: checkUserImage(user.userId)
      }))
    },
    calls: async (_: any, __: any, { db }: Context) => {
      return await db.collection('calls').find().toArray()
    },
    getOrCreateUser: async (_: any, { userId, defaultLanguages }: { userId: string, defaultLanguages: string[] }, { db }: Context) => {
      let user = await db.collection('users').findOne({ userId })
      
      if (!user) {
        // Create new user with default values
        const newUser = {
          _id: new ObjectId(),
          userId,
          name: '',
          statuses: [],
          languages: defaultLanguages,  // Use provided default languages
          timestamp: Date.now(),
          locale: 'en',
          online: false
        }
        
        await db.collection('users').insertOne(newUser)
        user = newUser
      }

      // At this point user must exist
      if (!user) throw new Error('Failed to create user')

      return {
        userId: user.userId,
        name: user.name,
        statuses: user.statuses || [],
        languages: user.languages || [],
        timestamp: user.timestamp,
        locale: user.locale,
        online: user.online || false,
        hasImage: checkUserImage(user.userId)
      }
    },
  },
  Mutation: {
    updateUser: async (_: any, { input }: { input: any }, { db }: Context) => {
      const { userId, name, statuses, locale, languages, online } = input
      const timestamp = Date.now()

      const result = await db.collection('users').findOneAndUpdate(
        { userId },
        { 
          $set: { 
            name, 
            statuses, 
            timestamp,
            locale,
            languages,
            online
          } 
        },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      )

      if (!result) throw new Error('Failed to update user')

      const transformedUser = {
        userId: result.userId,
        name: result.name,
        statuses: result.statuses || [],
        languages: result.languages || [],
        timestamp: result.timestamp,
        locale: result.locale,
        online: result.online || false,
        hasImage: checkUserImage(userId)
      }

      // Get updated user list and publish
      const users = await db.collection('users').find().toArray()
      
      // Map MongoDB documents to User type
      const typedUsers = users.map(user => ({
        userId: user.userId,
        name: user.name,
        statuses: user.statuses || [],
        languages: user.languages || [],
        timestamp: user.timestamp,
        locale: user.locale,
        online: user.online || false,
        hasImage: checkUserImage(user.userId)
      }))

      pubsub.publish('USERS_UPDATED', typedUsers)

      console.log('Publishing users updated: ' + typedUsers.length)

      return transformedUser
    },
    connectWithUser: async (_: any, { input }: { input: any }, { db }: Context) => {
      const { targetUserId, type, offer, answer, iceCandidate, videoEnabled, audioEnabled, quality } = input
      const initiatorUserId = input.initiatorUserId || ''
      let callId = input.callId

      let connection: any
      
      // Only handle calls table for specific types
      if (type === 'offer') {
        // Create new call record for offer
        connection = await db.collection('calls').insertOne({
          initiatorUserId,
          targetUserId,
          type: 'offer',
          duration: 0
        })
        callId = connection.insertedId.toString()
      } else if (type === 'answer' && callId) {
        // Update call status to connected
        connection = await db.collection('calls').findOneAndUpdate(
          { _id: ObjectId.createFromHexString(callId) },
          { $set: { type: 'connected' } },
          { returnDocument: 'after' }
        )
      } else if (type === 'finished' && callId) {
        // Update call status to finished and calculate duration
        const objectId = ObjectId.createFromHexString(callId)
        connection = await db.collection('calls').findOneAndUpdate(
          { _id: objectId },
          { 
            $set: { 
              type: 'finished',
              duration: Math.floor((Date.now() - objectId.getTimestamp().getTime()) / 1000)
            } 
          },
          { returnDocument: 'after' }
        )
      }

      // Get user info for publishing
      const initiator = await db.collection('users').findOne({ userId: initiatorUserId })
      if (!initiator) {
        console.error('no user found for initiator', { initiatorUserId })
        return connection
      }

      const targetUser = await db.collection('users').findOne({ userId: targetUserId })
      if (!targetUser) {
        console.error('no user found for target', { targetUserId })
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
          },
          callId
        },
        userId: targetUserId
      }

      // Additional fields based on type
      const additionalFields: Record<string, Record<string, any>> = {
        offer: { offer },
        answer: { offer: connection?.offer, answer },
        'ice-candidate': { offer: connection?.offer, iceCandidate },
        finished: { },
        changeTracks: { videoEnabled, audioEnabled, quality }
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
        initiatorUserId,
        callId
      }
    }
  },
  Subscription: {
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
          fromUser: payload.onConnectionRequest.from.name,
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
}; 