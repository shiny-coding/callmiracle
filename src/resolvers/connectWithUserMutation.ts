import { Context } from './types'
import { pubsub } from './pubsub'
import { ObjectId } from 'mongodb'

export const connectWithUserMutation = async (_: any, { input }: { input: any }, { db }: Context) => {
  const { targetUserId, type, offer, answer, iceCandidate, videoEnabled, audioEnabled, quality, meetingId } = input
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
      duration: 0,
      meetingId
    })
    callId = connection.insertedId.toString()
  } else if (!callId) {
    throw new Error('CallId is required')
  }

  const objectId = ObjectId.createFromHexString(callId)
  // Get current call state
  const currentCall = await db.collection('calls').findOne({ _id: objectId })

  if (type === 'answer') {
    // Update call status to connected
    connection = await db.collection('calls').findOneAndUpdate(
      { _id: objectId },
      { $set: { type: 'connected' } },
      { returnDocument: 'after' }
    )
  } else if (type === 'finished' || type == 'expired') {
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
      callId,
      meetingId: currentCall?.meetingId
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

  if ( type === 'offer' && meetingId ) {
    const meeting = await db.collection('meetings').findOne({ _id: ObjectId.createFromHexString(meetingId) })
    if ( meeting ) {
      additionalFields.offer.meetingLastCallTime = meeting.lastCallTime
    }
  }

  // Create a unique topic for this user's connection requests
  const topic = `CONNECTION_REQUEST:${targetUserId}`

  const callEvent = {
    ...basePayload,
    ...additionalFields[type]
  }

  console.log('Publishing connection request:', { callEvent })
  
  pubsub.publish(topic, { callEvent })

  return {
    type,
    offer: connection?.offer || null,
    answer: connection?.answer || null,
    iceCandidate: connection?.iceCandidate || null,
    targetUserId,
    initiatorUserId,
    callId,
    meetingId
  }
}
