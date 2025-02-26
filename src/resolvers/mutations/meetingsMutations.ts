import { Context } from '../types'
import { ObjectId } from 'mongodb'
import { getUserId } from '@/lib/userId'
import { canConnectMeetings, determineBestStartTime } from './connectMeetings'

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
      allowedMaxAge,
      languages,
      startTime,
      peerMeetingId
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
            languages,
            startTime,
            peerMeetingId
          },
        },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      );
      
      // If this meeting already has a peer, update the peer meeting
      if (peerMeetingId) {
        await db.collection('meetings').updateOne(
          { _id: new ObjectId(peerMeetingId) },
          { 
            $set: { 
              peerMeetingId: meetingId.toString(),
              startTime
            } 
          }
        );
        return result;
      }
      
      // Try to find a matching meeting
      const now = new Date().getTime();
      const potentialPeers = await db.collection('meetings').find({
        userId: { $ne: userId },
        peerMeetingId: { $exists: false },
        timeSlots: { $elemMatch: { $gte: now } }
      }).toArray();
      
      if (potentialPeers.length === 0) return result;
      
      // Get all users for checking preferences
      const userIds = [userId, ...potentialPeers.map(m => m.userId)];
      const users = await db.collection('users').find({
        userId: { $in: userIds }
      }).toArray();
      
      // Find the best matching meeting
      let bestMatch = null;
      let bestOverlap = null;
      let bestOverlapDuration = 0;
      
      for (const peer of potentialPeers) {
        const overlap = canConnectMeetings(result, peer, users);
        if (overlap) {
          // Find the slot with the longest overlap
          const longestOverlap = overlap.reduce((max: any, slot: any) => 
            slot.duration > max.duration ? slot : max, overlap[0]);
            
          if (longestOverlap.duration > bestOverlapDuration) {
            bestMatch = peer;
            bestOverlap = overlap;
            bestOverlapDuration = longestOverlap.duration;
          }
        }
      }
      
      if (bestMatch && bestOverlap) {
        // Determine the best start time
        const bestStartTime = determineBestStartTime(bestOverlap, result, bestMatch);
        
        // Update both meetings
        await db.collection('meetings').updateOne(
          { _id: meetingId },
          { $set: { 
              peerMeetingId: bestMatch._id.toString(),
              startTime: bestStartTime
            } 
          }
        );
        
        await db.collection('meetings').updateOne(
          { _id: bestMatch._id },
          { $set: { 
              peerMeetingId: meetingId.toString(),
              startTime: bestStartTime
            } 
          }
        );
        
        // Return the updated meeting
        return await db.collection('meetings').findOne({ _id: meetingId });
      }
      
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