import { Context } from './types'
import { ObjectId } from 'mongodb'
import { transformUser } from './utils'

export const meetingsQueries = {
  meetings: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    try {
      // 1. Fetch all meetings for the user
      const userMeetings = await db.collection('meetings').find({ userId }).toArray()
      
      // 2. Extract peerMeetingIds from user's meetings
      const peerMeetingIds = userMeetings
        .filter(meeting => meeting.peerMeetingId)
        .map(meeting => new ObjectId(meeting.peerMeetingId))
      
      // 3. Fetch all peer meetings in one query
      const peerMeetings = peerMeetingIds.length > 0 
        ? await db.collection('meetings').find({ 
            _id: { $in: peerMeetingIds } 
          }).toArray()
        : []
      
      // 4. Get user IDs from peer meetings
      const peerUserIds = []
      for (const meeting of peerMeetings) {
        peerUserIds.push(meeting.userId)
      }
      
      // 5. Fetch all peer users in one query
      const peerUsers = peerUserIds.length > 0
        ? await db.collection('users').find({ 
            userId: { $in: peerUserIds } 
          }).toArray()
        : []
      
      // 6. Transform data to the requested structure
      const result = []
      for (const meeting of userMeetings) {
        let peerMeeting: any = null
        let peerUser: any = null
        
        if (meeting.peerMeetingId) {
          peerMeeting = peerMeetings.find( pm => pm._id.toString() === meeting.peerMeetingId )

          if (peerMeeting) {
            peerUser = peerUsers.find(user => user.userId === peerMeeting.userId)
          }
        }
        
        result.push({
          meeting,
          peerMeeting,
          peerUser: peerUser ? transformUser(peerUser) : null
        })
      }
      
      return result
    } catch (error) {
      console.error('Error fetching meetings:', error)
      throw new Error('Failed to fetch meetings')
    }
  }
} 