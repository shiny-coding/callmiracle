import { Context } from './types'
import { ObjectId } from 'mongodb'
import { Call, CallEvent, Meeting, MeetingTransparency, NotificationType, User } from '@/generated/graphql'
import { callDurationHistogram, totalCallDurationMetric } from '@/utils/metrics'
import { getLogger } from '@/utils/logger'
import { publishSubscriptionEvent } from '@/utils/pubsubHelper'
import { incrementUserMeetingsStats } from '@/utils/meetingsStatsUtils'
import { publishPushNotification, startRepeatedCallNotifications, stopRepeatedCallNotifications } from './pushNotifications'

// Helper function to publish meeting discall notification
export async function publishCallNotification(notificationType: NotificationType, db: any, initiator: User, targetUser: User, call: Call, showInitiatorName: boolean = true) {
  const logger = await getLogger()

  // Use initiator name if showInitiatorName is true, otherwise null for anonymous calls
  const peerUserName = showInitiatorName ? initiator.name : null

  // INCOMING_CALL is a transient real-time event - only send push notification, no DB record
  // If the call is missed, MISSED_CALL will create the DB record
  const isIncomingCall = notificationType === NotificationType.IncomingCall
  let notificationId: ObjectId | undefined

  if (!isIncomingCall) {
    // Create a notification in the database (only for non-INCOMING_CALL types)
    const notificationResult = await db.collection('notifications').insertOne({
      userId: targetUser._id,
      userName: targetUser.name,
      type: notificationType,
      seen: false,
      peerUserName,
      peerUserId: new ObjectId(initiator._id),
      meetingId: call.meetingId ? new ObjectId(call.meetingId) : undefined,
      createdAt: new Date()
    })
    notificationId = notificationResult.insertedId
  }

  // Publish notification event (for real-time updates in the app)
  const topic = `SUBSCRIPTION_EVENT:${targetUser._id.toString()}`
  publishSubscriptionEvent(topic, {
    notificationEvent: { type: notificationType as NotificationType, peerUserName },
    logger
  })

  // Send push notification (always sent, including for INCOMING_CALL)
  await publishPushNotification(db, targetUser, {
    type: notificationType,
    peerUserName: peerUserName || '',
    meetingId: call.meetingId ? new ObjectId(call.meetingId) : undefined,
    notificationId,
    callId: call._id ? new ObjectId(call._id) : undefined,
    initiatorUserId: new ObjectId(initiator._id)
  })

  logger.info('Published call notification event', {
    notificationType,
    targetUserName: targetUser.name,
    targetUserId: targetUser._id.toString(),
    initiatorName: initiator.name,
    showInitiatorName,
    callId: call._id?.toString(),
    storedInDb: !isIncomingCall
  })
}

export const callUserMutation = async (_: any, { input }: { input: any }, { db }: Context) => {
  const logger = await getLogger()
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
  logger.info('Processing call user mutation', {
    type,
    targetName: targetUser.name,
    initiatorName: initiator.name,
    callId: _callId?.toString(),
    meetingId: _meetingId?.toString()
  })

  // Only handle calls table for specific types
  // Track meetingLastCallTime for initiate event (computed from meeting transparency)
  let initiateMeetingLastCallTime: number | null = null

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

    // Get the newly created call for notification
    call = await db.collection('calls').findOne<Call>({ _id: _callId })

    // Send immediate push notification for incoming call
    // Determine if we should show the caller's name based on meeting transparency
    let showInitiatorName = true
    if (_meetingId) {
      const meeting = await db.collection('meetings').findOne<Meeting>({ _id: _meetingId })
      // Show name only if there was at least one successful call in this meeting before
      showInitiatorName = !!meeting?.lastCallTime || meeting?.transparency === MeetingTransparency.Transparent
      // Compute meetingLastCallTime for the initiate event (same logic as offer)
      initiateMeetingLastCallTime = meeting?.lastCallTime ||
        (meeting?.transparency === MeetingTransparency.Transparent ? 1 : null)
    }
    await publishCallNotification(NotificationType.IncomingCall, db, initiator, targetUser, call as Call, showInitiatorName)

    // Start repeated push notifications for incoming call (iOS doesn't persist notifications)
    const peerUserName = showInitiatorName ? initiator.name : null
    startRepeatedCallNotifications(
      db,
      targetUser,
      {
        type: NotificationType.IncomingCall,
        peerUserName: peerUserName || '',
        meetingId: _meetingId || undefined,
        callId: _callId,
        initiatorUserId: _initiatorUserId
      },
      _callId.toString()
    )
  } 
  if (!_callId) {
    throw new Error('CallId is required')
  }

  // Get current call state
  call = await db.collection('calls').findOne<Call>({ _id: _callId })

  // Store offer data in call record so callee can retrieve it if they missed the real-time event
  if (type === 'offer') {
    await db.collection('calls').updateOne(
      { _id: _callId },
      {
        $set: {
          pendingOffer: {
            offer,
            videoEnabled,
            audioEnabled,
            quality,
            createdAt: new Date()
          }
        }
      }
    )
  }

  if (type === 'answer') {
    // Stop repeated call notifications when call is answered
    await stopRepeatedCallNotifications(_callId.toString())

    // Update call status to connected and clear pending offer
    call = await db.collection('calls').findOneAndUpdate(
      { _id: _callId },
      { $set: { type: 'connected' }, $unset: { pendingOffer: '' } },
      { returnDocument: 'after' }
    ) as Call|null

  } else if (type === 'finished' || type === 'expired') {
    // Stop repeated call notifications when call ends
    await stopRepeatedCallNotifications(_callId.toString())
    // Only set duration if the call was connected and is now finished
    let callDurationS = 0;
    // currentCall?.type === 'connected' means that the expired is due to call timeout
    const updateFields = type === 'finished' || (type === 'expired' && call?.type === 'connected')
      ? { 
          type: 'finished',
          durationS: callDurationS = Math.floor((Date.now() - _callId.getTimestamp().getTime()) / 1000)
        }
      : { type: 'expired', durationM: 0 }

    // Update call status and clear pending offer
    call = await db.collection('calls').findOneAndUpdate(
      { _id: _callId },
      { $set: updateFields, $unset: { pendingOffer: '' } },
      { returnDocument: 'after' }
    ) as Call|null

    // Record call duration metrics when call finishes successfully
    if (callDurationS > 0) {
      callDurationHistogram.record(callDurationS)
      totalCallDurationMetric.add(callDurationS)

      await incrementUserMeetingsStats(db, _initiatorUserId, { callsDurationS: callDurationS })
      await incrementUserMeetingsStats(db, _targetUserId, { callsDurationS: callDurationS })
    }

    if (type === 'expired' && call?.type !== 'connected') {
      // For meeting calls, check if meetingLastCallTime exists to determine if we should show the caller's name
      let showInitiatorName = true
      if (_meetingId) {
        const meeting = await db.collection('meetings').findOne<Meeting>({ _id: _meetingId })
        // Show name only if there was at least one successful call in this meeting before
        showInitiatorName = !!meeting?.lastCallTime || meeting?.transparency === MeetingTransparency.Transparent
      }
      await publishCallNotification(NotificationType.MissedCall, db, initiator, targetUser, call as Call, showInitiatorName)
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
          logger.info('Updated meeting duration after call', {
            meetingId: _meetingId.toString(),
            totalDurationS: updateFields.totalDurationS,
            addedDurationS: callDurationS
          });
        } else if (type === 'expired') {
          logger.info('Updated meeting missed call time', {
            meetingId: _meetingId.toString(),
            lastMissedCallTime: updateFields.lastMissedCallTime
          });
        }
      } catch (err) {
        logger.error('Failed to update meeting duration', {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          meetingId: _meetingId?.toString(),
          callType: type,
          callDurationS
        });
      }
    }
  }

  if (type === 'busy') {
    // Stop repeated call notifications when callee is busy
    await stopRepeatedCallNotifications(_callId.toString())
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
    initiate: { meetingLastCallTime: initiateMeetingLastCallTime },
    offer: { videoEnabled, audioEnabled, quality, offer },
    answer: { videoEnabled, audioEnabled, quality, answer },
    'ice-candidate': { iceCandidate },
    'renegotiate-offer': { offer },
    'renegotiate-answer': { answer },
    finished: { },
    expired: { },
    busy: { },
    updateMediaState: { videoEnabled, audioEnabled, quality }
  }

  if ( type === 'offer' && _meetingId ) {
    const meeting = await db.collection('meetings').findOne({ _id: _meetingId })
    if ( meeting ) {
      // For transparent meetings, set a truthy value so client shows peer name
      // Same logic as showInitiatorName for push notifications
      additionalFields.offer.meetingLastCallTime = meeting.lastCallTime ||
        (meeting.transparency === MeetingTransparency.Transparent ? 1 : null)
    }
  }

  // Create a unique topic for this user's call requests
  const topic = `SUBSCRIPTION_EVENT:${_targetUserId.toString()}`

  const callEvent = {
    ...basePayload,
    ...additionalFields[type]
  } as unknown as CallEvent

  logger.info('Publishing call event', {
    type: callEvent.type,
    callId: callEvent.callId?.toString(),
    meetingId: callEvent.meetingId?.toString(),
    targetUserId: _targetUserId.toString(),
    hasOffer: !!callEvent.offer,
    hasAnswer: !!callEvent.answer,
    hasIceCandidate: !!callEvent.iceCandidate
  })
  
  publishSubscriptionEvent(topic, { callEvent, logger })

  return callEvent
}
