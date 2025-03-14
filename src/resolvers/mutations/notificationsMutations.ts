import { Context } from '../types'
import { ObjectId } from 'mongodb'

export const notificationsMutations = {
  setNotificationSeen: async (_: any, { id }: { id: string }, { db }: Context) => {
    try {
      const result = await db.collection('notifications').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { seen: true } },
        { returnDocument: 'after' }
      )
      
      if (!result) {
        throw new Error(`Notification with ID ${id} not found`)
      }
      
      return {
        ...result,
        _id: result._id.toString()
      }
    } catch (error) {
      console.error('Error updating notification:', error)
      throw new Error('Failed to update notification')
    }
  }
} 