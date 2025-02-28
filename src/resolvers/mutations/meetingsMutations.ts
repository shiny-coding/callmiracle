import { Context } from '../types'
import { ObjectId } from 'mongodb'
import { getUserId } from '@/lib/userId'
import { canConnectMeetings, determineBestStartTime } from './connectMeetings'

async function tryConnectMeetings(meeting: any, db: any, userId: string) {
  // Try to find a matching meeting
  const now = new Date().getTime();
  const potentialPeers = await db.collection('meetings').find({
    userId: { $ne: userId },
    peerMeetingId: { $exists: false },
    timeSlots: { $elemMatch: { $gte: now } }
  }).toArray();

  if (potentialPeers.length === 0) return meeting;

  // Get all users for checking preferences
  const userIds = [userId, ...potentialPeers.map((m: any) => m.userId)];
  const users = await db.collection('users').find({
    userId: { $in: userIds }
  }).toArray();

  // Find peers with at least one hour of overlap
  const oneHourInMs = 60 * 60 * 1000;
  const peersWithHourOverlap = [];
  const peersWithAnyOverlap = [];

  // Check each potential peer for overlap
  for (const peer of potentialPeers) {
    const overlap = canConnectMeetings(meeting, peer, users);
    if (!overlap) continue;
    
    // Find the slot with the longest overlap
    const longestOverlap = overlap.reduce((max: any, slot: any) => 
      slot.duration > max.duration ? slot : max, overlap[0]);
    
    // Store the peer and overlap information
    const peerInfo = { peer, overlap };
    
    // If this peer has at least one hour overlap, add to the hour overlap list
    if (longestOverlap.duration >= oneHourInMs) {
      peersWithHourOverlap.push(peerInfo);
    }
    
    // Add to the list of all peers with any overlap
    peersWithAnyOverlap.push(peerInfo);
  }

  const peersToChooseFrom = peersWithHourOverlap.length ? peersWithHourOverlap : peersWithAnyOverlap;
  if (peersToChooseFrom.length === 0) return meeting;

  const randomIndex = Math.floor(Math.random() * peersToChooseFrom.length);
  const bestMatch = peersToChooseFrom[randomIndex].peer;
  const bestOverlap = peersToChooseFrom[randomIndex].overlap;

  // Determine the best start time
  const bestStartTime = determineBestStartTime(bestOverlap, meeting, bestMatch);
  
  // Update this meeting with the peer meeting ID and start time
  const updatedMeeting = await db.collection('meetings').updateOne(
    { _id: meeting._id },
    { $set: { 
        peerMeetingId: bestMatch._id.toString(),
        startTime: bestStartTime
      } 
    }
  );
  
  // Update the peer meeting with this meeting's ID and the same start time
  await db.collection('meetings').updateOne(
    { _id: bestMatch._id },
    { $set: { 
        peerMeetingId: meeting._id.toString(),
        startTime: bestStartTime
      } 
    }
  );

  return updatedMeeting;
}

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
      let result = await db.collection('meetings').findOneAndUpdate(
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
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );
      
      // If this meeting doesn't have a peer yet, try to find a match
      if (!peerMeetingId) {
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