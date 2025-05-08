import { ObjectId } from 'mongodb'
import { Context } from './types'
import { Call } from '@/generated/graphql'

export const callsQueries = {
  getCalls: async (_: any, __: any, { db }: Context) => {
    return await db.collection('calls').find().toArray()
  },

  getCallHistory: async (_: any, { userId }: { userId: string }, { db }: Context) => {

    const _userId = new ObjectId(userId)

    const calls = await db.collection('calls').find<Call>({
      $or: [
        { initiatorUserId: _userId },
        { targetUserId: _userId }
      ],
      type: 'finished'
    }).toArray()

    // Group calls by other user's ID
    const callsByUser = new Map()
    
    for (const call of calls) {
      const _otherUserId = call.initiatorUserId.toString() == _userId.toString() ? 
                          call.targetUserId : call.initiatorUserId

      if (!callsByUser.has(_otherUserId)) {
        callsByUser.set(_otherUserId, {
          calls: [],
          totalDurationS: 0,
          lastCallAt: 0
        })
      }
      
      const userCalls = callsByUser.get(_otherUserId)
      userCalls.calls.push(call)
      userCalls.totalDurationS += call.durationS
      userCalls.lastCallAt = Math.max(userCalls.lastCallAt, (call._id as any as ObjectId).getTimestamp().getTime())
    }

    // Get user details and format response
    const result = []
    for (const [otherUserId, callData] of callsByUser.entries()) {
      const user = await db.collection('users').findOne({ _id: otherUserId })
      if (!user) continue

      result.push({
        user: user,
        lastCallAt: callData.lastCallAt,
        durationS: callData.totalDurationS,
        totalCalls: callData.calls.length
      })
    }

    // Sort by most recent call
    return result.sort((a, b) => b.lastCallAt - a.lastCallAt)
  },
  getDetailedCallHistory: async (_: any, { userId, targetUserId }: { userId: string, targetUserId: string }, { db }: Context) => {
    
    const _userId = new ObjectId(userId)
    const _targetUserId = new ObjectId(targetUserId)
    
    // Find all finished calls between these two users
    const calls = await db.collection('calls')
      .find({
        $and: [
          { 
            $or: [
              { initiatorUserId: _userId, targetUserId: _targetUserId },
              { initiatorUserId: _targetUserId, targetUserId: _userId }
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