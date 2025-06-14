import { Interest, Meeting, MeetingStatus, NotificationType, User } from "@/generated/graphql";
import { ObjectId } from "mongodb";
import { publishMeetingNotification } from "./meetingsNotifications";
import { combineAdjacentSlots, getNonBlockedInterests, getInterestsOverlap, SLOT_DURATION, TimeRange } from '@/utils/meetingUtils'

// Helper function to find overlapping time ranges
export const findOverlappingRanges = (ranges1: TimeRange[], ranges2: TimeRange[], minDurationM: number): TimeRange[] => {
  const overlaps: TimeRange[] = [];

  const minDuration = minDurationM * 60 * 1000;
  
  for (const range1 of ranges1) {
    for (const range2 of ranges2) {
      const overlapStart = Math.max(range1.start, range2.start);
      const overlapEnd = Math.min(range1.end, range2.end);
      const duration = overlapEnd - overlapStart;
      
      if (duration >= minDuration) {
        overlaps.push({ start: overlapStart, end: overlapEnd });
      }
    }
  }
  
  return overlaps;
}

// Helper function to check if two meetings can be connected
export const canConnectMeetings = (meeting1: any, meeting2: any, users: any[]): TimeRange[]|false => {
  // Check if meetings are from different users
  if (meeting1.userId.equals(meeting2.userId)) return false;
  
  // Find the users
  const user1 = users.find(u => u._id.equals(meeting1.userId));
  const user2 = users.find(u => u._id.equals(meeting2.userId));
  if (!user1 || !user2) return false;
  
  // Check gender preferences
  if (user1.sex === 'male' && !meeting2.allowedMales) return false;
  if (user1.sex === 'female' && !meeting2.allowedFemales) return false;
  if (user2.sex === 'male' && !meeting1.allowedMales) return false;
  if (user2.sex === 'female' && !meeting1.allowedFemales) return false;
  
  // Check age preferences
  if (user1.birthYear) {
    const age1 = new Date().getFullYear() - user1.birthYear;
    if (age1 < meeting2.allowedMinAge || age1 > meeting2.allowedMaxAge) return false;
  }
  if (user2.birthYear) {
    const age2 = new Date().getFullYear() - user2.birthYear;
    if (age2 < meeting1.allowedMinAge || age2 > meeting1.allowedMaxAge) return false;
  }
  
  // Check language overlap
  const languageOverlap = meeting1.languages.filter((lang: string) => 
    meeting2.languages.includes(lang)
  );
  if (languageOverlap.length === 0) return false;
  
  // Use getNonBlockedInterests for both meetings
  const interests1 = getNonBlockedInterests(meeting1, user1, user2);
  const interests2 = getNonBlockedInterests(meeting2, user2, user1);
  const interestOverlap = getInterestsOverlap(interests1, interests2);
  if (interestOverlap.length === 0) return false;
  
  // Check time slot overlap
  const minDurationM = Math.max(meeting1.minDurationM, meeting2.minDurationM);
  
  // Combine adjacent slots into time ranges
  const timeRanges1 = combineAdjacentSlots(meeting1.timeSlots);
  const timeRanges2 = combineAdjacentSlots(meeting2.timeSlots);
  
  // Find overlapping time ranges
  const overlappingRanges = findOverlappingRanges(timeRanges1, timeRanges2, minDurationM);
  
  return overlappingRanges.length > 0 ? overlappingRanges : false;
}

// Helper function to determine the best start time
export const determineBestStartTime = (overlappingRanges: TimeRange[], meeting1: any, meeting2: any) => {
  // Sort slots by start time
  const sortedRanges = [...overlappingRanges].sort((a, b) => a.start - b.start);
  
  // Calculate durations for all slots
  const oneHourInMs = 60 * 60 * 1000;
  const rangesWithDurations = sortedRanges.map(range => ({
    ...range,
    duration: range.end - range.start
  }));
  
  //const timeToPrepare = 5 * 60 * 1000; // 10 minutes in milliseconds
  const timeToPrepare = 0; // temporary

  let rangesToChooseFrom;
  // Find slots with at least one hour duration
  const longRanges = rangesWithDurations.filter(range => range.duration >= oneHourInMs);
  
  // If we have slots with at least one hour duration, choose among those
  if (longRanges.length > 0) {
    rangesToChooseFrom = longRanges;
  } else {
    const maxDuration = Math.max(...rangesWithDurations.map(range => range.duration));
    // Find all slots with the maximum duration
    rangesToChooseFrom = rangesWithDurations.filter(range => range.duration === maxDuration);    
  }

  // If both prefer earlier, choose the earliest long slot
  if (meeting1.preferEarlier && meeting2.preferEarlier) {
    return rangesToChooseFrom[0].start + timeToPrepare;
  }
    
  // If both prefer later, choose the latest long slot
  if (!meeting1.preferEarlier && !meeting2.preferEarlier) {
    return rangesToChooseFrom[rangesToChooseFrom.length - 1].start + timeToPrepare;
  }
    
  // If preferences differ, choose a middle long slot
  return rangesToChooseFrom[Math.floor(rangesToChooseFrom.length / 2)].start + timeToPrepare;
}

// Define error symbols
export const MeetingAlreadyConnected = Symbol('MeetingAlreadyConnected');
export const PeerAlreadyConnected = Symbol('PeerAlreadyConnected');

export async function tryConnectMeetings(meeting: any, db: any, _userId: ObjectId) {
  // Try to find a matching meeting
  const now = new Date().getTime();
  const potentialPeers = await db.collection('meetings').find({
      userId: { $ne: _userId },
      peerMeetingId: null,
      timeSlots: { $elemMatch: { $gte: now } },
      status: MeetingStatus.Seeking
    }).toArray();

  if (potentialPeers.length === 0) return meeting;

  // Get all users for checking preferences
  const _userIds = [_userId, ...potentialPeers.map((m: any) => m.userId)];
  const users = await db.collection('users').find({
    _id: { $in: _userIds }
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
    const peerUser = users.find((u: any) => u._id.equals(peer.userId));
    const peerInfo = { peer, overlap, user: peerUser };
    
    // If this peer has at least one hour overlap, add to the hour overlap list
    if (longestOverlap.duration >= oneHourInMs) {
      peersWithHourOverlap.push(peerInfo);
    }
    
    // Add to the list of all peers with any overlap
    peersWithAnyOverlap.push(peerInfo);
  }

  let peersToChooseFrom = peersWithHourOverlap.length ? peersWithHourOverlap : peersWithAnyOverlap;
  if (peersToChooseFrom.length === 0) {
    console.log('No peers to choose from')
    return meeting;
  }

  // Use session for transaction
  const session = db.client.startSession();
  let updatedMeeting = meeting;
  const maxTries = 10;

  for (let i = 0; i < maxTries; i++) {
    const randomIndex = Math.floor(Math.random() * (peersToChooseFrom.length - 1));
    try {
      await session.withTransaction(async () => {

        const { peer: peerMeeting, overlap } = peersToChooseFrom[randomIndex];
        updatedMeeting = await tryConnectTwoMeetings(updatedMeeting, peerMeeting, overlap, db, session, NofitySelf.Yes)
      });
      break;
    } catch (err) {
      
      if (err === MeetingAlreadyConnected) {
        // Our meeting was already connected, get the new data
        updatedMeeting = await db.collection('meetings').findOne({ _id: meeting._id });

        console.log('Meeting was connected by another process: ', updatedMeeting._id, updatedMeeting.peerMeetingId);
        break;

      } else if (err === PeerAlreadyConnected) {

        const peerIdToRemove = peersToChooseFrom[randomIndex].peer._id;
        console.log('Peer was connected by another process, removing it from consideration: ', peerIdToRemove.toString());

        peersWithHourOverlap = peersWithHourOverlap.filter(p => !p.peer._id.equals(peerIdToRemove));
        peersWithAnyOverlap = peersWithAnyOverlap.filter(p => !p.peer._id.equals(peerIdToRemove));
        
        // Update the list we're choosing from
        peersToChooseFrom = peersWithHourOverlap.length ? peersWithHourOverlap : peersWithAnyOverlap;
        
        // If all peers are exhausted, break the loop
        if (peersToChooseFrom.length === 0) break;

      } else {
        throw err;
      }
    } finally {
      await session.endSession();
    }
  }

  return updatedMeeting;
}

export enum NofitySelf { No, Yes }

// throws MeetingAlreadyConnected or PeerAlreadyConnected
export async function tryConnectTwoMeetings(meeting: Meeting, peerMeeting: Meeting, overlap: TimeRange[], db: any, session: any, notifySelf: NofitySelf) {

  // Determine the best start time
  const bestStartTime = determineBestStartTime(overlap, meeting, peerMeeting);
  
  // Update this meeting with the peer meeting ID and start time
  const result = await db.collection('meetings').updateOne(
    { _id: meeting._id, peerMeetingId: null },
    { $set: { 
        peerMeetingId: peerMeeting._id,
        startTime: bestStartTime,
        status: MeetingStatus.Found
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
    { _id: peerMeeting._id, peerMeetingId: null },
    { $set: { 
        peerMeetingId: meeting._id,
        startTime: bestStartTime,
        status: MeetingStatus.Found
      }
    },
    { session }
  );
  
  if (peerResult.modifiedCount === 0) {
    // Peer was connected by another process
    throw PeerAlreadyConnected;
  }
  

  // Successfully connected
  const updatedMeeting = await db.collection('meetings').findOne(
    { _id: meeting._id },
    { session }
  );

  // If we get here, transaction was successful
  console.log('Connected meetings: ', updatedMeeting._id, updatedMeeting.peerMeetingId);

  setTimeout(async () => {
    await publishMeetingNotification(NotificationType.MeetingConnected, db, peerMeeting, updatedMeeting)

    if (notifySelf === NofitySelf.Yes) {
      await publishMeetingNotification(NotificationType.MeetingConnected, db, updatedMeeting, peerMeeting)
    }
  }) // do this after the transaction in which we're in, so the user will receive fresh data

  return updatedMeeting
}