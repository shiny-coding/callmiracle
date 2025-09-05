import { Context } from './types'
import { ObjectId } from 'mongodb'
import { BroadcastType } from '@/generated/graphql'
import { getLogger } from '@/utils/logger'
import { publishSubscriptionEvent } from '@/utils/pubsubHelper'

export async function publishBroadcastEvent(broadcastType: BroadcastType) {
  const logger = await getLogger()
  const topic = `SUBSCRIPTION_EVENT:ALL`
  publishSubscriptionEvent(topic, { 
    broadcastEvent: { type: broadcastType },
    logger
  })
  
  logger.info('Publishing broadcast event for all users', {
    broadcastType,
    topic
  })
}

export const notificationsMutations = {
  setNotificationSeen: async (_: any, { id }: { id: string }, { db }: Context) => {
    const logger = await getLogger()
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
      logger.error('Error updating notification', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        notificationId: id
      })
      throw new Error('Failed to update notification')
    }
  },
  
  setAllNotificationsSeen: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    const logger = await getLogger()
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
      logger.error('Error marking all notifications as seen', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId
      })
      throw new Error('Failed to mark all notifications as seen')
    }
  }
} 