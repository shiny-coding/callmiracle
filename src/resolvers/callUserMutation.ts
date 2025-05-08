import { Context } from './types'
import { pubsub } from './pubsub'
import { ObjectId } from 'mongodb'
import { Call, CallEvent, User } from '@/generated/graphql'

// Helper function to publish meeting discall notification
export async function publishCallNotification(notificationType: string, db: any, initiator: User, targetUser: User, call: Call) {
  
  // Create a notification in the database
  await db.collection('notifications').insertOne({
    userId: targetUser._id,
    userName: targetUser.name,
    type: notificationType,
    seen: false,
    peerUserName: initiator.name,
    createdAt: new Date()
  })
  
  // Publish notification event
  const topic = `SUBSCRIPTION_EVENT:${targetUser._id.toString()}`
  pubsub.publish(topic, { notificationEvent: { type: notificationType, call, user: targetUser, peerUserName: initiator.name } })
  
  console.log(`Published ${notificationType} event for peer:`, { name: targetUser.name, userId: targetUser._id.toString() })
}

export const callUserMutation = async (_: any, { input }: { input: any }, { db }: Context) => {
  const { type, offer, answer, iceCandidate, videoEnabled, audioEnabled, quality } = input
  const _initiatorUserId = new ObjectId(input.initiatorUserId)
  let _callId = input.callId ? new ObjectId(input.callId) : null
  const _targetUserId = new ObjectId(input.targetUserId)
  const _meetingId = input.meetingId ? new ObjectId(input.meetingId) : null

  let call: Call|null = null

  // Get user info for publishing
  const initiator = await db.collection('users').findOne<User>({ _id: _initiatorUserId })
  if (!initiator) {
    console.error('no user found for initiator', _initiatorUserId.toString())
    return null
  }

  const targetUser = await db.collection('users').findOne<User>({ _id: _targetUserId })
  if (!targetUser) {
    console.error('no user found for target', _targetUserId.toString())
    return null
  }      
  console.log('callUser:', { type, targetName: targetUser.name, initiatorName: initiator.name })

  // Only handle calls table for specific types
  if (type === 'initiate') {
    // Create new call record
    const _call = await db.collection('calls').insertOne({
      initiatorUserId: _initiatorUserId,
      targetUserId: _targetUserId,
      type: 'initiated',
      duration: 0,
      meetingId: _meetingId
    })
    _callId = _call.insertedId
  } 
  if (!_callId) {
    throw new Error('CallId is required')
  }

  // Get current call state
  call = await db.collection('calls').findOne<Call>({ _id: _callId })

  if (type === 'answer') {
    // Update call status to connected
    call = await db.collection('calls').findOneAndUpdate(
      { _id: _callId },
      { $set: { type: 'connected' } },
      { returnDocument: 'after' }
    ) as Call|null

  } else if (type === 'finished' || type == 'expired') {
    // Only set duration if the call was connected and is now finished
    let callDurationS = 0;
    // currentCall?.type === 'connected' means that the expired is due to call timeout
    const updateFields = type === 'finished' || (type === 'expired' && call?.type === 'connected')
      ? { 
          type: 'finished',
          durationS: callDurationS = Math.floor((Date.now() - _callId.getTimestamp().getTime()) / 1000)
        }
      : { type: 'expired', durationM: 0 }

    // Update call status
    call = await db.collection('calls').findOneAndUpdate(
      { _id: _callId },
      { $set: updateFields },
      { returnDocument: 'after' }
    ) as Call|null

    if (!_meetingId && type === 'expired' && call?.type !== 'connected') {
      await publishCallNotification('missed-call', db, initiator, targetUser, call as Call)
    }
    
    // If this call was for a meeting and has a duration, update the meeting's total duration
    if (_meetingId && (callDurationS > 0 || type === 'expired')) {
      try {
        const meeting = await db.collection('meetings').findOne({ _id: _meetingId });
        const updateFields: any = {}
        if (callDurationS > 0) {
          updateFields.totalDurationS = (meeting?.totalDurationS || 0) + callDurationS;
        }
        if (type === 'expired') {
          updateFields.lastMissedCallTime = Date.now()
        }
        
        await db.collection('meetings').updateOne(
          { _id: _meetingId },
          { $set: updateFields }
        );
        
        if (callDurationS > 0) {
          console.log(`Updated meeting ${_meetingId.toString()} duration to ${updateFields.totalDurationS}s`);
        } else if (type === 'expired') {
          console.log(`Updated meeting ${_meetingId.toString()} last missed call time to ${updateFields.lastMissedCallTime}`);
        }
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
    meetingId: call?.meetingId,
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

  // Create a unique topic for this user's call requests
  const topic = `SUBSCRIPTION_EVENT:${_targetUserId.toString()}`

  const callEvent = {
    ...basePayload,
    ...additionalFields[type]
  } as unknown as CallEvent

  console.log('Publishing call request:', { callEvent })
  
  pubsub.publish(topic, { callEvent })

  return callEvent
}
