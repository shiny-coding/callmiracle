import { ObjectId } from "mongodb"
import { canConnectMeetings, MeetingAlreadyConnected, NofitySelf, PeerAlreadyConnected, tryConnectTwoMeetings } from "./connectMeetings"
import { Context } from "@apollo/client/react/types/types"
import { BroadcastType, Meeting, MeetingOutput, MeetingStatus } from "@/generated/graphql"
import { SLOT_DURATION } from "@/utils/meetingUtils"
import { publishBroadcastEvent } from "./notificationsMutations"
import { tryConnectMeetings } from "./connectMeetings"

export enum MeetingError {
  CannotCreateMeetingInternalError = 'CannotCreateMeetingInternalError',
  CannotUpdateMeetingInternalError = 'CannotUpdateMeetingInternalError',
  CannotConnectMeetingInternalError = 'CannotConnectMeetingInternalError',
  MeetingAlreadyConnectedError = 'MeetingAlreadyConnectedError',
  MeetingDoNotSufficientlyOverlapError = 'MeetingDoNotSufficientlyOverlapError',
  MeetingNotCancelledError = 'MeetingNotCancelledError'
}

export const createOrUpdateMeeting = async (_: any, { input }: { input: any }, { db }: Context) : Promise<MeetingOutput> => {
  const { 
    groupId,
    userName,
    interests, 
    timeSlots, 
    minDurationM, 
    preferEarlier,
    allowedMales,
    allowedFemales,
    allowedMinAge,
    allowedMaxAge,
    languages,
    meetingToConnectId
  } = input

  if (!groupId) {
    return {
      error: 'GroupIdRequired'
    }
  }

  const _meetingId = input._id ? new ObjectId(input._id) : new ObjectId()
  const _meetingToConnectId = meetingToConnectId ? new ObjectId(meetingToConnectId) : undefined
  const _userId = new ObjectId(input.userId)
  const _groupId = new ObjectId(groupId)
  
  if (input.peerMeetingId && input._id) {
    return {
      error: MeetingError.MeetingNotCancelledError
    }
  }

  const lastSlotEnd = timeSlots[timeSlots.length - 1] + SLOT_DURATION
  const $set =  {
    userId: _userId,
    groupId: _groupId,
    userName,
    interests,
    timeSlots,
    lastSlotEnd,
    minDurationM,
    preferEarlier,
    allowedMales,
    allowedFemales,
    allowedMinAge,
    allowedMaxAge,
    languages,
    startTime: null,
    peerMeetingId : null,
    status: MeetingStatus.Seeking
  }

  if ( _meetingToConnectId ) {
    return await tryCreateMeetingAndConnect(_meetingToConnectId, _userId, $set, db)
  } else {
    return await createOrUpdateMeetingAndTryJoin(_meetingId, _userId, $set, db)
  }
}

async function createOrUpdateMeetingAndTryJoin(_meetingId: ObjectId, _userId: ObjectId, $set: any, db: any): Promise<MeetingOutput> {
  try {
    // Use upsert to either update existing or create new
    let meeting = await db.collection('meetings').findOneAndUpdate(
      { _id: _meetingId },
      {
        $set,
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
    console.log('Trying to find match for meeting: ', meeting?._id)
    meeting = await tryConnectMeetings(meeting, db, _userId)

    publishBroadcastEvent(BroadcastType.MeetingUpdated)

    return {
      meeting: meeting as any as Meeting,
      error: undefined
    }
  } catch (error) {
    console.error('Error creating/updating meeting:', error);
    return {
      meeting: undefined,
      error: _meetingId ? MeetingError.CannotUpdateMeetingInternalError : MeetingError.CannotCreateMeetingInternalError
    }
  }
}

async function tryCreateMeetingAndConnect(_meetingToConnectId: ObjectId, _userId: ObjectId, $set: any, db: any): Promise<MeetingOutput> {
  const session = db.client.startSession();
  const maxRetries = 5
  try {
    for (let i = 0; i < maxRetries; i++) {
      const meetingOutput = await doOneTry()
      if (meetingOutput) {
        if (meetingOutput.meeting) {
          publishBroadcastEvent(BroadcastType.MeetingUpdated)
        }
        return meetingOutput
      }
    }
    console.error(`Failed to connect meeting after ${maxRetries} retries`)
    return {
      error: MeetingError.CannotConnectMeetingInternalError
    }
  } finally {
    await session.endSession();
  }

  async function doOneTry(): Promise<MeetingOutput|null> {

    try {
      let myMeeting: any
      await session.withTransaction(async () => {
        const peerMeeting = await db.collection('meetings').findOne({ _id: _meetingToConnectId })
        if (!peerMeeting) throw new Error('Peer meeting not found')

        const insertResult = await db.collection('meetings').insertOne({
          ...$set,
          createdAt: new Date(),
          linkedToPeer: true
        });
        myMeeting = await db.collection('meetings').findOne({ _id: insertResult.insertedId });
        if (!myMeeting) {
          // This case should ideally not happen if insertOne succeeded
          throw new Error('Failed to retrieve the newly created meeting');
        }

        const _userIds = [_userId, peerMeeting.userId];
        const users = await db.collection('users').find({
          _id: { $in: _userIds }
        }).toArray();

        const overlap = canConnectMeetings(myMeeting, peerMeeting, users)
        if (!overlap) {
          return { error: MeetingError.MeetingDoNotSufficientlyOverlapError }
        }

        myMeeting = await tryConnectTwoMeetings(myMeeting, peerMeeting, overlap, db, session, NofitySelf.No)
      });

      return { meeting: myMeeting }

    } catch (err) {
      if (err === MeetingAlreadyConnected) {
        console.info('Our meeting was connected by someone else, retrying...')
        // our meeting was stolen by someone else, this is unlikely, but still might happen, lets retry again then
        return null;
      } else if (err === PeerAlreadyConnected) {
        console.info('Peer meeting is already connected by someone else')
        return { error: MeetingError.MeetingAlreadyConnectedError }
      } else {
        console.error('Error connecting meeting:', err)
        return { error: MeetingError.CannotConnectMeetingInternalError }
      }
    }
  }
}