import { Context } from './types'
import { ObjectId } from 'mongodb'

export const notificationsQueries = {
  getNotifications: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    try {
      // Fetch the last 20 notifications for this user
      const notifications = await db.collection('notifications')
        .find({ userId })
        .sort({ seen: 1, createdAt: -1 }) // Unseen first, then by date descending
        .limit(20)
        .toArray()
      
      // Get meeting IDs to fetch
      const meetingIds = notifications
        .filter(notification => notification.meetingId)
        .map(notification => new ObjectId(notification.meetingId))
      
      // Fetch meetings in a single query
      const meetings = meetingIds.length > 0 
        ? await db.collection('meetings').find({ 
            _id: { $in: meetingIds } 
          }).toArray()
        : []
      
      // Add meeting data to each notification
      const notificationsWithMeetings = notifications.map(notification => {
        const result: any = {
          ...notification,
          _id: notification._id.toString()
        }
        
        if (notification.meetingId) {
          const meeting = meetings.find(m => 
            m._id.toString() === notification.meetingId
          )
          if (meeting) {
            result.meeting = meeting
          }
        }
        
        return result
      })
      
      return notificationsWithMeetings
    } catch (error) {
      console.error('Error fetching notifications:', error)
      throw new Error('Failed to fetch notifications')
    }
  }
} 