import { Context } from '../types'
import { ObjectId } from 'mongodb'
import { tryConnectMeetings } from './connectMeetings'
import { pubsub } from '../pubsub';
import { MeetingStatus } from '@/generated/graphql';


interface UpdateMeetingStatusInput {
  _id: string
  status?: MeetingStatus
  lastCallTime?: Date
  totalDuration?: number
}

// Helper function to publish meeting disconnection notification
async function publishMeetingDisconnected(db: any, peerMeeting: any) {
  if (!peerMeeting) return
  
  // Get the peer user for notification
  const peerUser = await db.collection('users').findOne({ userId: peerMeeting.userId })
  
  if (peerUser) {
    // Create a notification in the database
    await db.collection('notifications').insertOne({
      userId: peerUser.userId,
      type: 'meeting-disconnected',
      seen: false,
      meetingId: peerMeeting._id.toString(),
      createdAt: new Date()
    })
    
    // Publish notification event
    const topic = `SUBSCRIPTION_EVENT:${peerMeeting.userId}`
    pubsub.publish(topic, { 
      notificationEvent: { 
        type: 'new-notification',
      } 
    })
    
    console.log('Published meeting-disconnected event for peer:', { 
      name: peerUser.name, 
      userId: peerMeeting.userId 
    })
  }
}

const meetingsMutations = {
  createOrUpdateMeeting: async (_: any, { input }: { input: any }, { db }: Context) => {
    const { 
      _id,
      userId,
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
      startTime,
      peerMeetingId
    } = input

    try {
      // Create a unique ID for new meetings
      const meetingId = _id ? new ObjectId(_id) : new ObjectId();
      
      // Use upsert to either update existing or create new
      let result = await db.collection('meetings').findOneAndUpdate(
        { _id: meetingId },
        {
          $set: {
            userId,
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
            startTime,
            peerMeetingId,
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
      if (!peerMeetingId) {
        console.log('Trying to find match for meeting: ', result?._id)
        result = await tryConnectMeetings(result, db, userId);
      }
      
      return result;
    } catch (error) {
      console.error('Error creating/updating meeting:', error);
      throw new Error('Failed to create/update meeting');
    }
  },
  deleteMeeting: async (_: any, { id }: { id: string }, context: any) => {
    try {
      const { db } = context

      // Find the meeting to ensure it belongs to the current user
      const meeting = await db.collection('meetings').findOne({
        _id: new ObjectId(id),
      })

      if (!meeting) {
        throw new Error('Meeting not found or you do not have permission to delete it')
      }

      // If this meeting has a peer, notify the peer user
      if (meeting.peerMeetingId) {
        // Get the peer meeting
        const peerMeeting = await db.collection('meetings').findOne({
          _id: new ObjectId(meeting.peerMeetingId)
        })

        if (peerMeeting) {
          // Update the peer meeting to remove the connection
          await db.collection('meetings').updateOne(
            { _id: new ObjectId(meeting.peerMeetingId) },
            { 
              $set: { 
                peerMeetingId: null,
                startTime: null,
                status: MeetingStatus.Seeking
              } 
            }
          )

          // Use the helper function to publish notification
          await publishMeetingDisconnected(db, peerMeeting)
        }
      }
      
      // Delete the meeting
      await db.collection('meetings').deleteOne({ 
        _id: new ObjectId(id), 
      })
      
      return { _id: id }
    } catch (error) {
      console.error('Error deleting meeting:', error)
      throw error
    }
  },
  updateMeetingStatus: async (_: any, { input }: { input: UpdateMeetingStatusInput }, { db }: Context) => {
    try {
      const { _id, status, lastCallTime } = input
      const objectId = new ObjectId(_id)
      
      // Create update object with only provided fields
      const updateFields: any = {}
      if (status !== undefined) updateFields.status = status
      if (lastCallTime !== undefined) updateFields.lastCallTime = lastCallTime
      
      // Update the meeting
      const updatedMeeting = await db.collection('meetings').findOneAndUpdate(
        { _id: objectId },
        { $set: updateFields },
        { returnDocument: 'after' }
      )
      
      if (!updatedMeeting) {
        console.error('Meeting not found', {
          meetingId: _id
        })
        throw new Error('Meeting not found')
      }

      console.log('Updating meeting:', updatedMeeting._id, status, lastCallTime)

      const disconnectPeer = status === MeetingStatus.Cancelled || status === MeetingStatus.Seeking
      
      // If status is CANCELLED or SEEKING and this meeting has a peer, handle peer notification
      if (updatedMeeting.peerMeetingId) {
        const peerMeetingId = new ObjectId(updatedMeeting.peerMeetingId)
        
        // Get the peer meeting
        const peerMeeting = await db.collection('meetings').findOne({
          _id: peerMeetingId
        })

        if (disconnectPeer) {
          updateFields.status = MeetingStatus.Seeking
          updateFields.peerMeetingId = null
          console.log('Disconnecting peer:', peerMeetingId)
        }

        if (peerMeeting) {
          // Update the peer meeting to SEEKING status
          await db.collection('meetings').updateOne(
            { _id: peerMeetingId },
            { $set: updateFields }
          )
          console.log('Updated peer meeting:', peerMeetingId, updateFields)
          
          if (disconnectPeer) {
            // Use the helper function to publish notification
            await publishMeetingDisconnected(db, peerMeeting)
          }
        }
      }
      
      return updatedMeeting
    } catch (error) {
      console.error('Error updating meeting status:', error)
      throw error
    }
  },
}

export default meetingsMutations 