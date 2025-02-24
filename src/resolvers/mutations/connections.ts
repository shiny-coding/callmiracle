import { Context } from '../types'
import { pubsub } from '../pubsub'
import { ObjectId } from 'mongodb'

export const connectionMutations = {
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
} 