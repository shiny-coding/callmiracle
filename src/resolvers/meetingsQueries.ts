import { Context } from './types'
import { ObjectId } from 'mongodb'
import { isMeetingPassed, getNonBlockedInterests } from '@/utils/meetingUtils'
import { Meeting, MeetingStatus, User } from '@/generated/graphql'
import { subDays } from 'date-fns'

export const meetingsQueries = {
  getMyMeetingsWithPeers: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    try {
      const _userId = new ObjectId(userId)

      // 1. Fetch all meetings for the user
      const userMeetings = await db.collection('meetings').find({ userId: _userId }).toArray()
      
      // 2. Extract peerMeetingIds from user's meetings
      const _peerMeetingIds = userMeetings
        .filter(meeting => meeting.peerMeetingId)
        .map(meeting => meeting.peerMeetingId)
      
      // 3. Fetch all peer meetings in one query
      const peerMeetings = _peerMeetingIds.length > 0 
        ? await db.collection('meetings').find({ 
            _id: { $in: _peerMeetingIds } 
          }).toArray()
        : []
      
      // 4. Get user IDs from peer meetings
      const _peerUserIds = []
      for (const meeting of peerMeetings) {
        _peerUserIds.push(meeting.userId)
      }
      
      // 5. Fetch all peer users in one query
      const _peerUsers = _peerUserIds.length > 0
        ? await db.collection('users').find({ 
            _id: { $in: _peerUserIds } 
          }).toArray()
        : []
      
      // 6. Transform data to the requested structure
      const meetingsWithPeers = []
      for (const meeting of userMeetings) {
        let peerMeeting: any = null
        let peerUser: any = null
        
        if (meeting.peerMeetingId) {
          peerMeeting = peerMeetings.find( pm => pm._id.equals(meeting.peerMeetingId) )

          if (peerMeeting) {
            peerUser = _peerUsers.find((user: any) => user._id.equals(peerMeeting.userId))
          }
        }
        
        meetingsWithPeers.push({
          meeting,
          peerMeeting,
          peerUser
        })
      }
      
      // 7. Sort meetings by earliest time slot or start time
      const now = new Date().getTime()

      console.log('meetingsWithPeers', meetingsWithPeers.map( mwp => mwp.meeting).map(
        m=> ({ id: m._id.toString(), interests: m.interests, status: m.status, timeSlots: m.timeSlots.map((t: number) => new Date(t))}))
      )

      meetingsWithPeers.sort((a, b) => {
        const aEnded = isMeetingPassed(a.meeting as any);
        const bEnded = isMeetingPassed(b.meeting as any);
        
        // Ended meetings go to the bottom
        if (aEnded && !bEnded) return 1;
        if (!aEnded && bEnded) return -1;
        
        // If meeting has a start time, use that for sorting
        if (!aEnded && !bEnded && a.meeting.startTime && b.meeting.startTime) {
          return a.meeting.startTime - b.meeting.startTime
        } else if (!aEnded && a.meeting.startTime) {
          return -1 // a has start time, b doesn't, so a comes first
        } else if (!aEnded && b.meeting.startTime) {
          return 1 // b has start time, a doesn't, so b comes first
        }

        const aSlots = a.meeting.timeSlots
        const bSlots = b.meeting.timeSlots
        
        // Otherwise, find the earliest future time slot for each meeting
        const aFutureSlot = aSlots.find((slot: number) => slot >= now)
        const bFutureSlot = bSlots.find((slot: number) => slot >= now)
        
        // If both have future slots, compare the earliest ones
        if (aFutureSlot && bFutureSlot) {
          return aFutureSlot - bFutureSlot
        } else if (aFutureSlot) {
          return -1 // a has future slots, b doesn't, so a comes first
        } else if (bFutureSlot) {
          return 1 // b has future slots, a doesn't, so b comes first
        }
        
        // If neither has future slots, compare the latest past slots
        if (aSlots.length > 0 && bSlots.length > 0) {
          return bSlots[bSlots.length - 1] - aSlots[aSlots.length - 1]
        } else if (aSlots.length > 0) {
          return -1
        } else if (bSlots.length > 0) {
          return 1
        }
        
        // If all else fails, sort by _id to ensure consistent ordering
        return a.meeting._id.toString().localeCompare(b.meeting._id.toString())
      })

      return meetingsWithPeers
    } catch (error) {
      console.error('Error fetching meetings:', error)
      throw new Error('Failed to fetch meetings')
    }
  },
  getFutureMeetingsWithPeers: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    try {
      const _userId = new ObjectId(userId)
      const currentUser: User | null = await db.collection('users').findOne<User>({ _id: _userId })
      if (!currentUser) throw new Error('Current user not found')

      const now = Date.now()

      // 1. Fetch meetings as before
      const meetings: Meeting[] = await db.collection('meetings').find<Meeting>({
        $and: [
          {
            $or: [
              { status: MeetingStatus.Seeking },
              {
                $and: [
                  { userId: _userId },
                  { status: { $in: [MeetingStatus.Called, MeetingStatus.Found] } }
                ]
              }
            ]
          },
          { lastSlotEnd: { $gt: now } }
        ]
      }).toArray()

      // 2. Collect unique userIds from meetings
      const userIdsSet = new Set<string>( meetings.map(m => m.userId?.toString()) )
      const userIds = Array.from(userIdsSet).map(id => new ObjectId(id))

      // 3. Fetch all users in one query
      const usersArr:User[] = userIds.length > 0
        ? await db.collection('users').find<User>({ _id: { $in: userIds } }).toArray()
        : []

      // 4. Map userId string to user object for quick lookup
      const usersById: { [key: string]: User } = {}
      for (let i = 0; i < usersArr.length; i++) {
        usersById[usersArr[i]._id.toString()] = usersArr[i]
      }

      const meetingsWithPeers = meetings
        .map(meeting => {
          const meetingUserId = meeting.userId?.toString()
          const meetingUser = usersById[meetingUserId]
          if (!meetingUser) return null

          // Filter interests blocked by meetingUser for currentUser
          const compatibleInterests = getNonBlockedInterests(
            meeting,
            meetingUser,
            { _id: _userId }
          )

          // Filter interests blocked by currentUser for meetingUser
          const compatibleForCurrentUser = getNonBlockedInterests(
            { interests: compatibleInterests },
            currentUser,
            { _id: new ObjectId(meetingUserId) }
          )
          if (compatibleForCurrentUser.length === 0) return null

          return {
            meeting: {
              ...meeting,
              interests: compatibleForCurrentUser,
              peerSex: meetingUser.sex
            },
            peerUser: {
              sex: meetingUser.sex
            }
          }
        })
        .filter(meeting => meeting)

      return meetingsWithPeers
    } catch (error) {
      console.error('Error fetching future meetings:', error)
      throw new Error('Failed to fetch future meetings')
    }
  }
} 