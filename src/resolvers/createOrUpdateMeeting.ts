import { ObjectId } from "mongodb"
import { canConnectMeetings, MeetingAlreadyConnected, MeetingDoNotSufficientlyOverlap, NofitySelf, PeerAlreadyConnected, tryConnectTwoMeetings } from "./connectMeetings"
import { Context } from "@apollo/client/react/types/types"
import { BroadcastType, Meeting, MeetingOutput, MeetingStatus } from "@/generated/graphql"
import { SLOT_DURATION } from "@/utils/meetingUtils"
import { publishBroadcastEvent } from "./notificationsMutations"
import { tryConnectMeetings } from "./connectMeetings"
import { createdMeetingsMetric, matchedMeetingsMetric, hourlyMeetingCreationsMetric, hourlyMatchingSuccessMetric } from "@/utils/metrics"
import { getLogger } from "@/utils/logger"
import { incrementUserMeetingsStats } from "@/utils/meetingsStatsUtils"

export enum MeetingError {
  CannotCreateMeetingInternalError = 'CannotCreateMeetingInternalError',
  CannotUpdateMeetingInternalError = 'CannotUpdateMeetingInternalError',
  CannotConnectMeetingInternalError = 'CannotConnectMeetingInternalError',
  MeetingAlreadyConnectedError = 'MeetingAlreadyConnectedError',
  MeetingDoNotSufficientlyOverlapError = 'MeetingDoNotSufficientlyOverlapError',
  MeetingNotCancelledError = 'MeetingNotCancelledError'
}

export const createOrUpdateMeeting = async (_: any, { input }: { input: any }, { db }: Context) : Promise<MeetingOutput> => {
  const logger = await getLogger()
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
    meetingToConnectId,
    transparency
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

  // Only set transparency if provided in input
  const meetingTransparency = transparency

  const lastSlotEnd = timeSlots[timeSlots.length - 1] + SLOT_DURATION
  const $set: any = {
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
  
  // Only set transparency if provided
  if (meetingTransparency) {
    $set.transparency = meetingTransparency
  }

  if ( _meetingToConnectId ) {
    return await tryCreateMeetingAndConnect(_meetingToConnectId, _userId, $set, db)
  } else {
    return await createOrUpdateMeetingAndTryJoin(!input._id, _meetingId, _userId, $set, db)
  }
}

async function createOrUpdateMeetingAndTryJoin(isNew: boolean,_meetingId: ObjectId, _userId: ObjectId, $set: any, db: any): Promise<MeetingOutput> {
  const logger = await getLogger()
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
    
    if (isNew) {
      const currentHour = new Date().getHours()
      createdMeetingsMetric.add(1)
      hourlyMeetingCreationsMetric.add(1, { hour: currentHour.toString() })
      await incrementUserMeetingsStats(db, _userId, { createdCount: 1 })
    }
    
    // If this meeting doesn't have a peer yet, try to find a match
    logger.info('Trying to find match for meeting', { 
      meetingId: meeting?._id?.toString(),
      userId: _userId.toString(),
      status: meeting?.status
    })
    const beforeMatchStatus = meeting.status
    meeting = await tryConnectMeetings(meeting, db, _userId)
    
    // Track when meetings get matched
    if (beforeMatchStatus === MeetingStatus.Seeking && meeting.status === MeetingStatus.Found) {
      const currentHour = new Date().getHours()
      matchedMeetingsMetric.add(1)
      hourlyMatchingSuccessMetric.add(1, { hour: currentHour.toString() })
    }

    publishBroadcastEvent(BroadcastType.MeetingUpdated)

    return {
      meeting: meeting as any as Meeting,
      error: undefined
    }
  } catch (error) {
    logger.error('Error creating/updating meeting', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      meetingId: _meetingId?.toString(),
      userId: _userId.toString(),
      groupId: $set.groupId?.toString()
    })
    return {
      meeting: undefined,
      error: _meetingId ? MeetingError.CannotUpdateMeetingInternalError : MeetingError.CannotCreateMeetingInternalError
    }
  }
}

async function tryCreateMeetingAndConnect(_meetingToConnectId: ObjectId, _userId: ObjectId, $set: any, db: any): Promise<MeetingOutput> {
  const logger = await getLogger()
  const session = db.client.startSession();
  const maxRetries = 5
  try {
    for (let i = 0; i < maxRetries; i++) {
      const meetingOutput = await doOneTry()
      if (meetingOutput) {
        if (meetingOutput.meeting) {

          const currentHour = new Date().getHours()
          createdMeetingsMetric.add(1)
          hourlyMeetingCreationsMetric.add(1, { hour: currentHour.toString() })
          await incrementUserMeetingsStats(db, _userId, { joinedCount: 1 })
          
          publishBroadcastEvent(BroadcastType.MeetingUpdated)
        }
        return meetingOutput
      }
    }
    logger.error('Failed to connect meeting after retries', {
      maxRetries,
      meetingToConnectId: _meetingToConnectId.toString(),
      userId: _userId.toString()
    })
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

        const _userIds = [_userId, peerMeeting.userId];
        const users = await db.collection('users').find({
          _id: { $in: _userIds }
        }).toArray();

        const overlap = canConnectMeetings(myMeeting, peerMeeting, users)
        if (!overlap) {
          throw MeetingDoNotSufficientlyOverlap
        }

        myMeeting = await tryConnectTwoMeetings(myMeeting, peerMeeting, overlap, db, session, NofitySelf.No)
        
        // Track matched meetings - both meetings are now matched
        const currentHour = new Date().getHours()
        matchedMeetingsMetric.add(1) // Both our meeting and peer meeting
        hourlyMatchingSuccessMetric.add(1, { hour: currentHour.toString() })
      });

      return { meeting: myMeeting }

    } catch (err) {
      if (err === MeetingAlreadyConnected) {
        logger.info('Meeting was connected by someone else, retrying', {
          meetingToConnectId: _meetingToConnectId.toString(),
          userId: _userId.toString()
        })
        // our meeting was stolen by someone else, this is unlikely, but still might happen, lets retry again then
        return null;
      } else if (err === PeerAlreadyConnected) {
        logger.info('Peer meeting is already connected by someone else', {
          meetingToConnectId: _meetingToConnectId.toString(),
          userId: _userId.toString()
        })
        return { error: MeetingError.MeetingAlreadyConnectedError }
      } else if (err === MeetingDoNotSufficientlyOverlap) {
        logger.info('Meetings do not sufficiently overlap', {
          meetingToConnectId: _meetingToConnectId.toString(),
          userId: _userId.toString()
        })
        return { error: MeetingError.MeetingDoNotSufficientlyOverlapError }
      } else {
        logger.error('Error connecting meeting', {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          meetingToConnectId: _meetingToConnectId.toString(),
          userId: _userId.toString()
        })
        return { error: MeetingError.CannotConnectMeetingInternalError }
      }
    }
  }
}