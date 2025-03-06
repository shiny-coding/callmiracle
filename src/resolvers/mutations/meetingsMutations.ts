import { Context } from '../types'
import { ObjectId } from 'mongodb'
import { getUserId } from '@/lib/userId'
import { canConnectMeetings, determineBestStartTime } from './connectMeetings'

// Define error symbols
const MeetingAlreadyConnected = Symbol('MeetingAlreadyConnected');
const PeerAlreadyConnected = Symbol('PeerAlreadyConnected');

async function tryConnectMeetings(meeting: any, db: any, userId: string) {
  // Try to find a matching meeting
  const now = new Date().getTime();
  const potentialPeers = await db.collection('meetings').find({
    userId: { $ne: userId },
    peerMeetingId: null,
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
  let peersWithHourOverlap = [];
  let peersWithAnyOverlap = [];

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

  let peersToChooseFrom = peersWithHourOverlap.length ? peersWithHourOverlap : peersWithAnyOverlap;
  if (peersToChooseFrom.length === 0) return meeting;

  // Use session for transaction
  const session = db.client.startSession();
  let updatedMeeting = meeting;
  const maxTries = 10;

  for (let i = 0; i < maxTries; i++) {
    const randomIndex = Math.floor(Math.random() * (peersToChooseFrom.length - 1));
    try {
      await session.withTransaction(async () => {

        const { peer, overlap } = peersToChooseFrom[randomIndex];
        
        // Determine the best start time
        const bestStartTime = determineBestStartTime(overlap, meeting, peer);
        
        // Update this meeting with the peer meeting ID and start time
        const result = await db.collection('meetings').updateOne(
          { _id: meeting._id, peerMeetingId: null },
          { $set: { 
              peerMeetingId: peer._id.toString(),
              startTime: bestStartTime
            }
          },
          { session }
        );
        
        if (result.modifiedCount === 0) {
          // This meeting was connected by another process
          throw MeetingAlreadyConnected;
        }
        
        // Update the peer meeting with this meeting's ID and the same start time
        const peerResult = await db.collection('meetings').updateOne(
          { _id: peer._id, peerMeetingId: null },
          { $set: { 
              peerMeetingId: meeting._id.toString(),
              startTime: bestStartTime
            }
          },
          { session }
        );
        
        if (peerResult.modifiedCount === 0) {
          // Peer was connected by another process
          throw PeerAlreadyConnected;
        }
        
        // Successfully connected
        updatedMeeting = await db.collection('meetings').findOne(
          { _id: meeting._id },
          { session }
        );
      });
      // If we get here, transaction was successful
      console.log('Connected meetings: ', updatedMeeting._id, updatedMeeting.peerMeetingId);
      break;
    } catch (err) {
      
      if (err === MeetingAlreadyConnected) {
        // Our meeting was already connected, get the new data
        updatedMeeting = await db.collection('meetings').findOne({ _id: meeting._id });
        console.log('Meeting was connected by another process: ', updatedMeeting._id, updatedMeeting.peerMeetingId);
        break;
      } else if (err === PeerAlreadyConnected) {
        const peerToRemove = peersToChooseFrom[randomIndex].peer._id.toString();
        console.log('Peer was connected by another process, removing it from consideration: ', peerToRemove._id);
        peersWithHourOverlap = peersWithHourOverlap.filter(p => p.peer._id.toString() !== peerToRemove);
        peersWithAnyOverlap = peersWithAnyOverlap.filter(p => p.peer._id.toString() !== peerToRemove);
        
        // Update the list we're choosing from
        peersToChooseFrom = peersWithHourOverlap.length ? peersWithHourOverlap : peersWithAnyOverlap;
        
        // If all peers are exhausted, break the loop
        if (peersToChooseFrom.length === 0) {
          break;
        }
      } else {
        throw err;
      }
    } finally {
      await session.endSession();
    }
  }

  return updatedMeeting;
}

interface UpdateMeetingStatusInput {
  _id: string
  status?: 'SEEKING' | 'FOUND' | 'CALLED' | 'FINISHED'
  lastCallTime?: number
  totalDuration?: number
}

const meetingsMutations = {
  updateMeetingStatus: async (_: any, { input }: { input: UpdateMeetingStatusInput }, { db }: Context) => {
    try {
      const { _id, status, lastCallTime, totalDuration } = input
      
      const updateData: any = {}
      if (status) updateData.status = status
      if (lastCallTime) updateData.lastCallTime = lastCallTime
      if (totalDuration !== undefined) updateData.totalDuration = totalDuration
      
      const result = await db.collection('meetings').findOneAndUpdate(
        { _id: new ObjectId(_id) },
        { $set: updateData },
        { returnDocument: 'after' }
      )
      
      if (!result) {
        throw new Error(`Meeting with ID ${_id} not found`)
      }
      
      return result
    } catch (error) {
      console.error('Error updating meeting status:', error)
      throw new Error('Failed to update meeting status')
    }
  },
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

export default meetingsMutations 