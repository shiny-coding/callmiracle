import { Context } from './types'
import { ObjectId } from 'mongodb'
import { pubsub } from './pubsub'
import { BroadcastType } from '@/generated/graphql'

export function publishBroadcastEvent(broadcastType: BroadcastType) {
  const topic = `SUBSCRIPTION_EVENT:ALL`
  pubsub.publish(topic, { broadcastEvent: { type: broadcastType } })
  
  console.log(`Broadcasted ${broadcastType} event for all users`)
}

export const notificationsMutations = {
  setNotificationSeen: async (_: any, { id }: { id: string }, { db }: Context) => {
    try {
      const _id = new ObjectId(id)
      const result = await db.collection('notifications').findOneAndUpdate(
        { _id },
        { $set: { seen: true } },
        { returnDocument: 'after' }
      )
      
      if (!result) {
        throw new Error(`Notification with ID ${_id.toString()} not found`)
      }
      
      return {
        ...result,
        _id: result._id.toString()
      }
    } catch (error) {
      console.error('Error updating notification:', error)
      throw new Error('Failed to update notification')
    }
  },
  
  setAllNotificationsSeen: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    try {
      const _userId = new ObjectId(userId)
      
      const result = await db.collection('notifications').updateMany(
        { 
          userId: _userId,
          seen: false 
        },
        { 
          $set: { seen: true } 
        }
      )
      
      return result.modifiedCount > 0
    } catch (error) {
      console.error('Error marking all notifications as seen:', error)
      throw new Error('Failed to mark all notifications as seen')
    }
  }
} 