import { Context } from './types'
import { pubsub } from './pubsub'
import { ObjectId } from 'mongodb'

export const callUserMutation = async (_: any, { input }: { input: any }, { db }: Context) => {
  const { type, offer, answer, iceCandidate, videoEnabled, audioEnabled, quality } = input
  const _initiatorUserId = new ObjectId(input.initiatorUserId)
  let _callId = input.callId ? new ObjectId(input.callId) : null
  const _targetUserId = new ObjectId(input.targetUserId)
  const _meetingId = input.meetingId ? new ObjectId(input.meetingId) : null

  let connection: any

  // Get user info for publishing
  const initiator = await db.collection('users').findOne({ _id: _initiatorUserId })
  if (!initiator) {
    console.error('no user found for initiator', { _initiatorUserId })
    return connection
  }

  const targetUser = await db.collection('users').findOne({ _id: _targetUserId })
  if (!targetUser) {
    console.error('no user found for target', { _targetUserId })
    return connection
  }      
  console.log('callUser:', { type, targetName: targetUser.name, initiatorName: initiator.name })

  // Only handle calls table for specific types
  if (type === 'initiate') {
    // Create new call record
    connection = await db.collection('calls').insertOne({
      initiatorUserId: _initiatorUserId,
      targetUserId: _targetUserId,
      type: 'initiated',
      duration: 0,
      meetingId: _meetingId
    })
    _callId = connection.insertedId
  } 
  if (!_callId) {
    throw new Error('CallId is required')
  }

  // Get current call state
  const currentCall = await db.collection('calls').findOne({ _id: _callId })

  if (type === 'answer') {
    // Update call status to connected
    connection = await db.collection('calls').findOneAndUpdate(
      { _id: _callId },
      { $set: { type: 'connected' } },
      { returnDocument: 'after' }
    )
  } else if (type === 'finished' || type == 'expired') {
    // Only set duration if the call was connected and is now finished
    let callDuration = 0;
    const updateFields = type === 'finished' || (type === 'expired' && currentCall?.type === 'connected')
      ? { 
          type: 'finished',
          duration: callDuration = Math.floor((Date.now() - _callId.getTimestamp().getTime()) / 1000)
        }
      : { type: 'expired', duration: 0 }

    // Update call status
    connection = await db.collection('calls').findOneAndUpdate(
      { _id: _callId },
      { $set: updateFields },
      { returnDocument: 'after' }
    )
    
    // If this call was for a meeting and has a duration, update the meeting's total duration
    if (_meetingId && callDuration > 0) {
      try {
        const meeting = await db.collection('meetings').findOne({ _id: _meetingId });
        
        // Add this call's duration to the meeting's total duration
        const totalDuration = (meeting?.totalDuration || 0) + callDuration;
        
        await db.collection('meetings').updateOne(
          { _id: _meetingId },
          { $set: { totalDuration } }
        );
        
        console.log(`Updated meeting ${_meetingId.toString()} duration to ${totalDuration}s`);
      } catch (err) {
        console.error('Failed to update meeting duration:', err);
      }
    }
  }

  // Prepare common payload data
  const basePayload = {
    type,
    from: initiator,
    callId: _callId,
    meetingId: currentCall?.meetingId,
    userId: _targetUserId
  }

  // Additional fields based on type
  const additionalFields: Record<string, Record<string, any>> = {
    offer: { videoEnabled, audioEnabled, quality, offer },
    answer: { videoEnabled, audioEnabled, quality, answer },
    'ice-candidate': { iceCandidate },
    finished: { },
    updateMediaState: { videoEnabled, audioEnabled, quality }
  }

  if ( type === 'offer' && _meetingId ) {
    const meeting = await db.collection('meetings').findOne({ _id: _meetingId })
    if ( meeting ) {
      additionalFields.offer.meetingLastCallTime = meeting.lastCallTime
    }
  }

  // Create a unique topic for this user's connection requests
  const topic = `SUBSCRIPTION_EVENT:${_targetUserId.toString()}`

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
    targetUserId: _targetUserId,
    initiatorUserId: _initiatorUserId,
    callId: _callId,
    meetingId: _meetingId
  }
}
