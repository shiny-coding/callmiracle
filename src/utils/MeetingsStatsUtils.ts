import { Db, ObjectId } from 'mongodb'
import { getLogger } from './logger'

export interface MeetingsStatsUpdate {
  createdCount?: number
  joinedCount?: number
  cancelledCount?: number
  attendedCount?: number
  callsDurationS?: number
  callsCount?: number
}

/**
 * Initialize user meeting statistics with default values
 */
export function getDefaultMeetingsStats() : MeetingsStatsUpdate {
  return {
    createdCount: 0,
    joinedCount: 0,
    cancelledCount: 0,
    attendedCount: 0,
    callsDurationS: 0,
    callsCount: 0
  }
}

/**
 * Update user meeting statistics in the database
 * @param db Database connection
 * @param userId User ID to update stats for
 * @param updates Object containing stat fields to update
 */
export async function incrementUserMeetingsStats(
  db: Db, 
  userId: string | ObjectId, 
  updates: MeetingsStatsUpdate
): Promise<void> {
  const logger = await getLogger()
  
  try {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId
    
    // Build the update object with $inc for incrementing stats
    const updateObj: any = {}
    
    Object.keys(updates).forEach(key => {
      const value = updates[key as keyof MeetingsStatsUpdate]
      if (value !== undefined && value !== 0) {
        updateObj[`meetingsStats.${key}`] = value
      }
    })
    
    if (Object.keys(updateObj).length === 0) {
      return // No updates to make
    }
    
    // First, ensure the user has a meetingsStats field
    await db.collection('users').updateOne(
      { 
        _id: userObjectId,
        meetingsStats: { $exists: false }
      },
      {
        $set: {
          meetingsStats: getDefaultMeetingsStats()
        }
      }
    )
    
    // Then increment the stats
    await db.collection('users').updateOne(
      { _id: userObjectId },
      {
        $inc: updateObj
      }
    )
    
    logger.debug('Updated user meeting stats', {
      userId: userObjectId.toString(),
      updates
    })
  } catch (error) {
    logger.error('Failed to update user meeting stats', {
      userId: userId.toString(),
      updates,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}
