import { ObjectId } from 'mongodb'
import { Context } from './types'
import { transformUser } from './utils'

export const callsQueries = {
  calls: async (_: any, __: any, { db }: Context) => {
    return await db.collection('calls').find().toArray()
  },

  callHistory: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    const calls = await db.collection('calls').find({
      $or: [
        { initiatorUserId: userId },
        { targetUserId: userId }
      ],
      type: 'finished'
    }).toArray()

    // Group calls by other user's ID
    const callsByUser = new Map()
    
    for (const call of calls) {
      const otherUserId = call.initiatorUserId === userId ? 
        call.targetUserId : call.initiatorUserId

      if (!callsByUser.has(otherUserId)) {
        callsByUser.set(otherUserId, {
          calls: [],
          totalDuration: 0,
          lastCallAt: 0
        })
      }
      
      const userCalls = callsByUser.get(otherUserId)
      userCalls.calls.push(call)
      userCalls.totalDuration += call.duration
      userCalls.lastCallAt = Math.max(userCalls.lastCallAt, 
        new ObjectId(call._id).getTimestamp().getTime())
    }

    // Get user details and format response
    const result = []
    for (const [otherUserId, callData] of callsByUser.entries()) {
      const user = await db.collection('users').findOne({ userId: otherUserId })
      if (!user) continue

      const transformedUser = transformUser(user)
      if (!transformedUser) continue

      result.push({
        user: transformedUser,
        lastCallAt: callData.lastCallAt,
        duration: callData.totalDuration,
        totalCalls: callData.calls.length
      })
    }

    // Sort by most recent call
    return result.sort((a, b) => b.lastCallAt - a.lastCallAt)
  },
  detailedCallHistory: async (_: any, { userId, targetUserId }: { userId: string, targetUserId: string }, { db }: Context) => {
    // Find all finished calls between these two users
    const calls = await db.collection('calls')
      .find({
        $and: [
          { 
            $or: [
              { initiatorUserId: userId, targetUserId: targetUserId },
              { initiatorUserId: targetUserId, targetUserId: userId }
            ]
          },
          { type: 'finished' }
        ]
      })
      .sort({ _id: -1 }) // Sort by ObjectId descending (most recent first)
      .toArray()

    return calls
  },
} 