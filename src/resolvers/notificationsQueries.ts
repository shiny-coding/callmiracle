import { Context } from './types'
import { ObjectId } from 'mongodb'

export const notificationsQueries = {
  getNotifications: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    try {
      const _userId = new ObjectId(userId)
      // Fetch the last 20 notifications for this user
      const notifications = await db.collection('notifications')
        .find({ userId: _userId })
        .sort({ seen: 1, createdAt: -1 }) // Unseen first, then by date descending
        .limit(20)
        .toArray()

      // Get meeting IDs to fetch
      const _meetingIds = notifications
        .filter(notification => notification.meetingId)
        .map(notification => notification.meetingId)

      // Fetch meetings in a single query
      const meetings = _meetingIds.length > 0
        ? await db.collection('meetings').find({
            _id: { $in: _meetingIds }
          }).toArray()
        : []

      // Get peer user IDs to fetch
      const _peerUserIds = notifications
        .filter(notification => notification.peerUserId)
        .map(notification => notification.peerUserId)

      // Fetch peer users in a single query
      const peerUsers = _peerUserIds.length > 0
        ? await db.collection('users').find({
            _id: { $in: _peerUserIds }
          }).toArray()
        : []

      // Add meeting and peerUser data to each notification
      const notificationsWithData = notifications.map(notification => {
        const result: any = {
          ...notification,
          _id: notification._id.toString()
        }

        if (notification.meetingId) {
          const meeting = meetings.find(m =>
            m._id.equals(notification.meetingId)
          )
          if (meeting) {
            result.meeting = meeting
          }
        }

        if (notification.peerUserId) {
          const peerUser = peerUsers.find(u =>
            u._id.equals(notification.peerUserId)
          )
          if (peerUser) {
            result.peerUser = peerUser
          }
        }

        return result
      })

      return notificationsWithData
    } catch (error) {
      console.error('Error fetching notifications:', error)
      throw new Error('Failed to fetch notifications')
    }
  }
} 