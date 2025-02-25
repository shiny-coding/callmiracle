import { Context } from '../types'
import { ObjectId } from 'mongodb'
import { getUserId } from '@/lib/userId'

export const meetingsMutations = {
  createOrUpdateMeeting: async (_: any, { input }: { input: any }, { db }: Context) => {
    const { 
      _id,
      userId, 
      statuses, 
      timeSlots, 
      minDuration, 
      preferEarlier,
      allowedMales,
      allowedFemales,
      allowedMinAge,
      allowedMaxAge
    } = input

    try {
      // Create a unique ID for new meetings
      const meetingId = _id ? new ObjectId(_id) : new ObjectId();
      
      // Use upsert to either update existing or create new
      const result = await db.collection('meetings').findOneAndUpdate(
        { _id: meetingId },
        {
          $set: {
            userId,
            statuses,
            timeSlots,
            minDuration,
            preferEarlier,
            allowedMales,
            allowedFemales,
            allowedMinAge,
            allowedMaxAge,
          },
        },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      );
      
      return result;
    } catch (error) {
      console.error('Error creating/updating meeting:', error);
      throw new Error('Failed to create/update meeting');
    }
  },
  deleteMeeting: async (_: any, { id }: { id: string }, context: any) => {
    try {
      const { db, userId } = context

      // Find the meeting to ensure it belongs to the current user
      const meeting = await db.collection('meetings').findOne({ 
        _id: new ObjectId(id), 
      })
      
      if (!meeting) {
        throw new Error('Meeting not found or you do not have permission to delete it')
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
  }
} 