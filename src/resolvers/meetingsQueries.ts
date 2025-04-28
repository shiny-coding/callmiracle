import { Context } from './types'
import { ObjectId } from 'mongodb'
import { isMeetingPassed } from '@/utils/meetingUtils'
import { MeetingStatus } from '@/generated/graphql'
import { subDays } from 'date-fns'

export const meetingsQueries = {
  getMeetings: async (_: any, { userId }: { userId: string }, { db }: Context) => {
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

      meetingsWithPeers.sort((a, b) => {
        const aEnded = isMeetingPassed(a.meeting as any);
        const bEnded = isMeetingPassed(b.meeting as any);
        
        // Ended meetings go to the bottom
        if (aEnded && !bEnded) return 1;
        if (!aEnded && bEnded) return -1;
        if (aEnded && bEnded) {
          // Both ended, sort by most recent end time (startTime or latest slot)
          if (a.meeting.startTime && b.meeting.startTime) {
            return b.meeting.startTime - a.meeting.startTime; // Most recent first
          } else if (a.meeting.startTime) {
            return -1; // Meeting with startTime comes first
          } else if (b.meeting.startTime) {
            return 1; // Meeting with startTime comes first
          }
        }
        
        // If meeting has a start time, use that for sorting
        if (!aEnded && !bEnded && a.meeting.startTime && b.meeting.startTime) {
          return a.meeting.startTime - b.meeting.startTime
        } else if (!aEnded && a.meeting.startTime) {
          return -1 // a has start time, b doesn't, so a comes first
        } else if (!aEnded && b.meeting.startTime) {
          return 1 // b has start time, a doesn't, so b comes first
        }
        
        // Otherwise, find the earliest future time slot for each meeting
        const aFutureSlots = a.meeting.timeSlots.filter((slot: number) => slot >= now)
        const bFutureSlots = b.meeting.timeSlots.filter((slot: number) => slot >= now)
        
        // If both have future slots, compare the earliest ones
        if (aFutureSlots.length > 0 && bFutureSlots.length > 0) {
          return Math.min(...aFutureSlots) - Math.min(...bFutureSlots)
        } else if (aFutureSlots.length > 0) {
          return -1 // a has future slots, b doesn't, so a comes first
        } else if (bFutureSlots.length > 0) {
          return 1 // b has future slots, a doesn't, so b comes first
        }
        
        // If neither has future slots, compare the latest past slots
        if (a.meeting.timeSlots.length > 0 && b.meeting.timeSlots.length > 0) {
          const aIsCancelled = a.meeting.status === MeetingStatus.Cancelled;
          const bIsCancelled = b.meeting.status === MeetingStatus.Cancelled;
          if (aIsCancelled && !bIsCancelled) return -1;
          if (!aIsCancelled && bIsCancelled) return +1;
          return Math.max(...a.meeting.timeSlots) - Math.max(...b.meeting.timeSlots)
        } else if (a.meeting.timeSlots.length > 0) {
          return -1
        } else if (b.meeting.timeSlots.length > 0) {
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
  getFutureMeetings: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    try {
      const _userId = new ObjectId(userId)
      const MS_IN_2_DAYS = 2 * 24 * 60 * 60 * 1000
      const now = Date.now()
      const twoDaysFromNow = now + MS_IN_2_DAYS

      const meetings = await db.collection('meetings').find({
        status: MeetingStatus.Seeking,
        lastSlotEnd: { $lt: twoDaysFromNow }
      }).toArray()

      return meetings
    } catch (error) {
      console.error('Error fetching future meetings:', error)
      throw new Error('Failed to fetch future meetings')
    }
  }
} 