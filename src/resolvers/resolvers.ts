import { Status, User } from '@/generated/graphql';
import { Db } from 'mongodb';
import { createPubSub } from 'graphql-yoga';
import { ObjectId } from 'mongodb';
import { existsSync } from 'fs';
import { join } from 'path';
import { getUserId } from '@/lib/userId';

// Helper function to check if user has profile image
const checkUserImage = (userId: string): boolean => {
  const imagePath = join(process.cwd(), 'public', 'profiles', `${userId}.jpg`);
  return existsSync(imagePath);
};

// Helper function to transform MongoDB user document to GraphQL User type
const transformUser = (user: any): User | null => {
  if (!user) return null
  return {
    userId: user.userId,
    name: user.name || '',
    statuses: user.statuses || [],
    languages: user.languages || [],
    timestamp: user.timestamp || Date.now(),
    locale: user.locale || 'en',
    online: user.online || false,
    hasImage: checkUserImage(user.userId)
  }
}

type ConnectionRequestPayload = {
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
      const users = await db.collection('users').find().sort({ timestamp: -1 }).toArray()
      const transformedUsers = users.map(transformUser).filter((user): user is User => user !== null)
      return transformedUsers
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

      const transformedUser = transformUser(user)
      if (!transformedUser) throw new Error('Failed to transform user')
      return transformedUser
    },
    callHistory: async (_: any, { userId }: { userId: string }, { db }: Context) => {
      const calls = await db.collection('calls').find({
        $or: [
          { initiatorUserId: userId },
          { targetUserId: userId }
        ],
        type: 'finished'
      }).toArray()

      // Group calls by other user's ID
      const callsByUser = new Map()
      
      for (const call of calls) {
        const otherUserId = call.initiatorUserId === userId ? 
          call.targetUserId : call.initiatorUserId

        if (!callsByUser.has(otherUserId)) {
          callsByUser.set(otherUserId, {
            calls: [],
            totalDuration: 0,
            lastCallAt: 0
          })
        }
        
        const userCalls = callsByUser.get(otherUserId)
        userCalls.calls.push(call)
        userCalls.totalDuration += call.duration
        userCalls.lastCallAt = Math.max(userCalls.lastCallAt, 
          new ObjectId(call._id).getTimestamp().getTime())
      }

      // Get user details and format response
      const result = []
      for (const [otherUserId, callData] of callsByUser.entries()) {
        const user = await db.collection('users').findOne({ userId: otherUserId })
        if (!user) continue

        const transformedUser = transformUser(user)
        if (!transformedUser) continue

        result.push({
          user: transformedUser,
          lastCallAt: callData.lastCallAt,
          duration: callData.totalDuration,
          totalCalls: callData.calls.length
        })
      }

      // Sort by most recent call
      return result.sort((a, b) => b.lastCallAt - a.lastCallAt)
    },
    detailedCallHistory: async (_: any, { userId, targetUserId }: { userId: string, targetUserId: string }, { db }: Context) => {
      // Find all finished calls between these two users
      const calls = await db.collection('calls')
        .find({
          $and: [
            { 
              $or: [
                { initiatorUserId: userId, targetUserId: targetUserId },
                { initiatorUserId: targetUserId, targetUserId: userId }
              ]
            },
            { type: 'finished' }
          ]
        })
        .sort({ _id: -1 }) // Sort by ObjectId descending (most recent first)
        .toArray()

      return calls
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

      const transformedUser = transformUser(result)
      if (!transformedUser) throw new Error('Failed to transform updated user')

      // Get updated user list and publish
      const users = await db.collection('users').find().toArray()
      const transformedUsers = users.map(transformUser).filter((user): user is User => user !== null)

      pubsub.publish('USERS_UPDATED', transformedUsers)
      console.log('Publishing users updated: ' + transformedUsers.length)

      return transformedUser
    },
    connectWithUser: async (_: any, { input }: { input: any }, { db }: Context) => {
      const { targetUserId, type, offer, answer, iceCandidate, videoEnabled, audioEnabled, quality } = input
      const initiatorUserId = input.initiatorUserId || ''
      let callId = input.callId

      let connection: any

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

      // Only handle calls table for specific types
      if (type === 'initiate') {
        // Create new call record
        connection = await db.collection('calls').insertOne({
          initiatorUserId,
          targetUserId,
          type: 'initiated',
          duration: 0
        })
        callId = connection.insertedId.toString()
      } else if (!callId) {
        throw new Error('CallId is required')
      }
    
      const objectId = ObjectId.createFromHexString(callId)
      if (type === 'answer') {
        // Update call status to connected
        connection = await db.collection('calls').findOneAndUpdate(
          { _id: objectId },
          { $set: { type: 'connected' } },
          { returnDocument: 'after' }
        )
      } else if (type === 'finished' || type == 'expired') {
        // Get current call state
        const currentCall = await db.collection('calls').findOne({ _id: objectId })
        
        // Only set duration if the call was connected and is now finished
        const updateFields = type === 'finished' || (type === 'expired' && currentCall?.type === 'connected')
          ? { 
              type: 'finished',
              duration: Math.floor((Date.now() - objectId.getTimestamp().getTime()) / 1000)
            }
          : { type: 'expired', duration: 0 }

        // Update call status
        connection = await db.collection('calls').findOneAndUpdate(
          { _id: objectId },
          { $set: updateFields },
          { returnDocument: 'after' }
        )
      }

      // Prepare common payload data
      const basePayload = {
        onConnectionRequest: {
          type,
          from: initiator,
          callId
        },
        userId: targetUserId
      }

      // Additional fields based on type
      const additionalFields: Record<string, Record<string, any>> = {
        offer: { videoEnabled, audioEnabled, quality, offer },
        answer: { videoEnabled, audioEnabled, quality, answer },
        'ice-candidate': { iceCandidate },
        finished: { },
        updateMediaState: { videoEnabled, audioEnabled, quality }
      }

      // Create a unique topic for this user's connection requests
      const topic = `CONNECTION_REQUEST:${targetUserId}`

      const publishData = {
        ...basePayload,
        onConnectionRequest: {
          ...basePayload.onConnectionRequest,
          ...additionalFields[type]
        }
      }

      console.log('Publishing connection request:', publishData)
      
      pubsub.publish(topic, publishData)

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
}; 