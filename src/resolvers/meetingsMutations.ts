import { Context } from './types'
import { ObjectId } from 'mongodb'
import { BroadcastType, Meeting, MeetingStatus, NotificationType } from '@/generated/graphql';
import { createOrUpdateMeeting } from './createOrUpdateMeeting';
import { publishMeetingNotification } from './publishNotifications';
import { calledMeetingsMetric, cancelledMeetingsMetric, deletedMeetingsMetric } from '@/utils/metrics';
import { getLogger } from '@/utils/logger';
import { publishBroadcastEvent } from './notificationsMutations';
import { incrementUserMeetingsStats } from '@/utils/meetingsStatsUtils';

interface UpdateMeetingStatusInput {
  _id: string
  status?: MeetingStatus
  lastCallTime?: Date
  totalDuration?: number
}

const updateMeetingStatus = async (_: any, { input }: { input: UpdateMeetingStatusInput }, { db }: Context) => {
  const logger = await getLogger()
  try {
    const { status, lastCallTime } = input
    const _id = new ObjectId(input._id)

    const meeting = await db.collection('meetings').findOne({ _id })
    const _peerMeetingId = meeting?.peerMeetingId
    const currentStatus = meeting?.status

    // Create update object with only provided fields
    const updateFields: any = {}
    if (status !== undefined) {
      updateFields.status = status
      if (status === MeetingStatus.Cancelled) {
        updateFields.peerMeetingId = null
        updateFields.startTime = null
      }
    }
    if (lastCallTime !== undefined) updateFields.lastCallTime = lastCallTime
    
    // Update the meeting
    const updatedMeeting = await db.collection('meetings').findOneAndUpdate(
      { _id },
      { $set: updateFields },
      { returnDocument: 'after' }
    )
    
    if (!updatedMeeting) {
      logger.error('Meeting not found for status update', { 
        meetingId: _id.toString(),
        requestedStatus: status,
        requestedLastCallTime: lastCallTime
      })
      throw new Error('Meeting not found ' + _id.toString())
    }

    logger.info('Updated meeting status', { 
      meetingId: updatedMeeting._id.toString(),
      newStatus: status,
      lastCallTime,
      previousStatus: currentStatus
    })

    // Track when meetings transition to Called status
    if (status !== undefined && currentStatus !== status && status === MeetingStatus.Called) {
      calledMeetingsMetric.add(1)
      await incrementUserMeetingsStats(db, meeting?.userId, { attendedCount: 1 })
    }

    // Track when meetings are cancelled (only count matched meetings for cancellation rate)
    if (currentStatus !== status && status === MeetingStatus.Cancelled) {
      cancelledMeetingsMetric.add(1)
      await incrementUserMeetingsStats(db, meeting?.userId, { cancelledCount: 1 })
    }

    const peerMeeting = _peerMeetingId ? await db.collection('meetings').findOne({ _id: _peerMeetingId }) : null

    const disconnectPeer = status === MeetingStatus.Cancelled || status === MeetingStatus.Finished
    
    // If status is CANCELLED or FINISHED and this meeting has a peer, handle peer notification
    if (_peerMeetingId) {

      if (disconnectPeer) {
        // if peer meeting was linked to our meeting, finish it, otherwise update to seeking
        updateFields.status = peerMeeting?.linkedToPeer ? MeetingStatus.Finished : MeetingStatus.Seeking
        updateFields.peerMeetingId = null
        updateFields.startTime = null
        logger.info('Disconnecting peer meeting', { 
          peerMeetingId: _peerMeetingId.toString(),
          newPeerStatus: updateFields.status,
          linkedToPeer: peerMeeting?.linkedToPeer
        })
      }

      if (peerMeeting) {
        await db.collection('meetings').updateOne(
          { _id: _peerMeetingId },
          { $set: updateFields }
        )
        logger.info('Updated peer meeting', { 
          peerMeetingId: _peerMeetingId.toString(),
          updateFields
        })
        
        if ( status === MeetingStatus.Finished ) {
          await publishMeetingNotification(NotificationType.MeetingFinished, db, peerMeeting, updatedMeeting)
        } else if (disconnectPeer) {
          // Use the helper function to publish notification
          await publishMeetingNotification(NotificationType.MeetingDisconnected, db, peerMeeting, updatedMeeting)
        }  
      }
    } else if (currentStatus === MeetingStatus.Seeking) {
      // if the meeting was in seeking status, notify all users that the meeting was updated
      publishBroadcastEvent(BroadcastType.MeetingUpdated)
    }
    
    return updatedMeeting
  } catch (error) {
    logger.error('Error updating meeting status', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      meetingId: input._id,
      requestedStatus: input.status
    })
    throw error
  }
}

export const meetingsMutations = {
  createOrUpdateMeeting: createOrUpdateMeeting,

  deleteMeeting: async (_: any, { id }: { id: string }, context: any) => {
    const logger = await getLogger()
    try {
      const { db } = context
      const _id = new ObjectId(id)

      // Find the meeting to ensure it belongs to the current user
      const meeting = await db.collection('meetings').findOne({ _id: _id, })

      if (!meeting) {
        throw new Error('Meeting not found or you do not have permission to delete it')
      }

      // If this meeting has a peer, notify the peer user
      if (meeting.peerMeetingId) {
        // Get the peer meeting
        const peerMeeting = await db.collection('meetings').findOne({ _id: meeting.peerMeetingId })

        if (peerMeeting) {
          // Update the peer meeting to remove the connection
          await db.collection('meetings').updateOne(
            { _id: meeting.peerMeetingId },
            { 
              $set: { 
                peerMeetingId: null,
                startTime: null,
                status: MeetingStatus.Seeking
              } 
            }
          )

          // Use the helper function to publish notification
          await publishMeetingNotification(NotificationType.MeetingDisconnected, db, peerMeeting, meeting)
        }
      }
      
      // Track meeting deletion (affects peer)
      if (meeting.peerMeetingId) {
        deletedMeetingsMetric.add(1)
      }
      
      // Note: We don't decrement meeting stats on deletion to preserve historical data
      // Users can still see their total created/joined counts even for deleted meetings

      // Delete the meeting
      await db.collection('meetings').deleteOne({ _id })
      
      logger.info('Meeting deleted successfully', {
        meetingId: id,
        hadPeer: !!meeting.peerMeetingId
      })

      if (!meeting.peerMeetingId && meeting.status === MeetingStatus.Seeking) {
        // if the meeting was in seeking status, notify all users that the meeting was deleted
        publishBroadcastEvent(BroadcastType.MeetingUpdated)
      }
      
      return { _id }
    } catch (error) {
      logger.error('Error deleting meeting', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        meetingId: id
      })
      throw error
    }
  },
  updateMeetingStatus
}

