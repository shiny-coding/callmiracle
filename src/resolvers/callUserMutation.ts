import { Context } from './types'
import { pubsub } from './pubsub'
import { ObjectId } from 'mongodb'

export const callUserMutation = async (_: any, { input }: { input: any }, { db }: Context) => {
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
  console.log('callUser:', { type, targetName: targetUser.name, initiatorName: initiator.name })

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
    let callDuration = 0;
    const updateFields = type === 'finished' || (type === 'expired' && currentCall?.type === 'connected')
      ? { 
          type: 'finished',
          duration: callDuration = Math.floor((Date.now() - objectId.getTimestamp().getTime()) / 1000)
        }
      : { type: 'expired', duration: 0 }

    // Update call status
    connection = await db.collection('calls').findOneAndUpdate(
      { _id: objectId },
      { $set: updateFields },
      { returnDocument: 'after' }
    )
    
    // If this call was for a meeting and has a duration, update the meeting's total duration
    if (meetingId && callDuration > 0) {
      try {
        const meetingObjectId = ObjectId.createFromHexString(meetingId);
        const meeting = await db.collection('meetings').findOne({ _id: meetingObjectId });
        
        // Add this call's duration to the meeting's total duration
        const totalDuration = (meeting?.totalDuration || 0) + callDuration;
        
        await db.collection('meetings').updateOne(
          { _id: meetingObjectId },
          { $set: { totalDuration } }
        );
        
        console.log(`Updated meeting ${meetingId} duration to ${totalDuration}s`);
      } catch (err) {
        console.error('Failed to update meeting duration:', err);
      }
    }
  }

  // Prepare common payload data
  const basePayload = {
    type,
    from: initiator,
    callId,
    meetingId: currentCall?.meetingId,
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
  const topic = `SUBSCRIPTION_EVENT:${targetUserId}`

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
