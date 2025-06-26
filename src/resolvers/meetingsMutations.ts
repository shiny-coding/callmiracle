import { Context } from './types'
import { ObjectId } from 'mongodb'
import { MeetingStatus, NotificationType } from '@/generated/graphql';
import { createOrUpdateMeeting } from './createOrUpdateMeeting';
import { publishMeetingNotification } from './publishNotifications';

interface UpdateMeetingStatusInput {
  _id: string
  status?: MeetingStatus
  lastCallTime?: Date
  totalDuration?: number
}

const updateMeetingStatus = async (_: any, { input }: { input: UpdateMeetingStatusInput }, { db }: Context) => {
  try {
    const { status, lastCallTime } = input
    const _id = new ObjectId(input._id)

    const meeting = await db.collection('meetings').findOne({ _id })
    const _peerMeetingId = meeting?.peerMeetingId

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
      console.error('Meeting not found', { meetingId: _id.toString() })
      throw new Error('Meeting not found ' + _id.toString())
    }

    console.log('Updated meeting:', updatedMeeting._id.toString(), status, lastCallTime)

    const disconnectPeer = status === MeetingStatus.Cancelled || status === MeetingStatus.Finished
    
    // If status is CANCELLED or FINISHED and this meeting has a peer, handle peer notification
    if (_peerMeetingId) {
      
      // Get the peer meeting
      const peerMeeting = await db.collection('meetings').findOne({ _id: _peerMeetingId })

      if (disconnectPeer) {
        // if peer meeting was linked to our meeting, finish it, otherwise update to seeking
        updateFields.status = peerMeeting?.linkedToPeer ? MeetingStatus.Finished : MeetingStatus.Seeking
        updateFields.peerMeetingId = null
        updateFields.startTime = null
        console.log('Disconnecting peer:', _peerMeetingId.toString())
      }

      if (peerMeeting) {
        // Update the peer meeting to SEEKING status
        await db.collection('meetings').updateOne(
          { _id: _peerMeetingId },
          { $set: updateFields }
        )
        console.log('Updated peer meeting:', _peerMeetingId.toString(), updateFields)
        
        if ( status === MeetingStatus.Finished ) {
          await publishMeetingNotification(NotificationType.MeetingFinished, db, peerMeeting, updatedMeeting)
        } else if (disconnectPeer) {
          // Use the helper function to publish notification
          await publishMeetingNotification(NotificationType.MeetingDisconnected, db, peerMeeting, updatedMeeting)
        }  
      }
    }
    
    return updatedMeeting
  } catch (error) {
    console.error('Error updating meeting status:', error)
    throw error
  }
}

export const meetingsMutations = {
  createOrUpdateMeeting: createOrUpdateMeeting,

  deleteMeeting: async (_: any, { id }: { id: string }, context: any) => {
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
      
      // Delete the meeting
      await db.collection('meetings').deleteOne({ _id })
      
      return { _id }
    } catch (error) {
      console.error('Error deleting meeting:', error)
      throw error
    }
  },
  updateMeetingStatus
}

