import { Context } from './types'
import { ObjectId } from 'mongodb'
import { tryConnectMeetings } from './connectMeetings'
import { pubsub } from './pubsub';
import { MeetingStatus } from '@/generated/graphql';


interface UpdateMeetingStatusInput {
  _id: string
  status?: MeetingStatus
  lastCallTime?: Date
  totalDuration?: number
}

// Helper function to publish meeting disconnection notification
export async function publishMeetingNotification(notificationType: string, db: any, peerMeeting: any) {
  
  // Get the peer user for notification
  const peerUser = await db.collection('users').findOne({ _id: peerMeeting.userId })
  
  if (peerUser) {
    // Create a notification in the database
    await db.collection('notifications').insertOne({
      userId: peerUser._id,
      userName: peerUser.name,
      type: notificationType,
      seen: false,
      meetingId: peerMeeting._id,
      createdAt: new Date()
    })
    
    // Publish notification event
    const topic = `SUBSCRIPTION_EVENT:${peerMeeting.userId.toString()}`
    pubsub.publish(topic, { notificationEvent: { type: notificationType, meeting: peerMeeting, user: peerUser } })
    
    console.log(`Published ${notificationType} event for peer:`, { name: peerUser.name, userId: peerMeeting.userId.toString() })
  }
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

    const disconnectPeer = status === MeetingStatus.Cancelled || status === MeetingStatus.Seeking
    
    // If status is CANCELLED or SEEKING and this meeting has a peer, handle peer notification
    if (_peerMeetingId) {
      
      // Get the peer meeting
      const peerMeeting = await db.collection('meetings').findOne({ _id: _peerMeetingId })

      if (disconnectPeer) {
        updateFields.status = MeetingStatus.Seeking
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
        
        if (disconnectPeer) {
          // Use the helper function to publish notification
          await publishMeetingNotification('meeting-disconnected', db, peerMeeting)
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
  createOrUpdateMeeting: async (_: any, { input }: { input: any }, { db }: Context) => {
    const { 
      userName,
      statuses, 
      timeSlots, 
      minDuration, 
      preferEarlier,
      allowedMales,
      allowedFemales,
      allowedMinAge,
      allowedMaxAge,
      languages,
    } = input

    const _meetingId = input._id ? new ObjectId(input._id) : new ObjectId()
    const _userId = new ObjectId(input.userId)
    if ( input.peerMeetingId ) {
      throw new Error('Meeting needs to be cancelled to be updated')
    }

    try {

      // Use upsert to either update existing or create new
      let result = await db.collection('meetings').findOneAndUpdate(
        { _id: _meetingId },
        {
          $set: {
            userId: _userId,
            userName,
            statuses,
            timeSlots,
            minDuration,
            preferEarlier,
            allowedMales,
            allowedFemales,
            allowedMinAge,
            allowedMaxAge,
            languages,
            startTime: null,
            peerMeetingId : null,
            status: MeetingStatus.Seeking
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );
      
      // If this meeting doesn't have a peer yet, try to find a match
      console.log('Trying to find match for meeting: ', result?._id)
      result = await tryConnectMeetings(result, db, _userId);
      
      return result;
    } catch (error) {
      console.error('Error creating/updating meeting:', error);
      throw new Error('Failed to create/update meeting');
    }
  },
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
          await publishMeetingNotification('meeting-disconnected', db, peerMeeting)
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
