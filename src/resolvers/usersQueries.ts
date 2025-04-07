import { Context } from './types'
import { transformUser } from './utils'
import { ObjectId } from 'mongodb'

export const usersQueries = {
  getUsers: async (_: any, { userId, onlyFriends } : { userId: string, onlyFriends?: boolean }, { db }: Context) => {
    // Get all users
    const users = await db.collection('users').find().sort({ timestamp: -1 }).toArray()
    
    // If onlyFriends is true and userId is provided, filter to show only friends
    if (onlyFriends && userId) {
      const currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) })
      if (currentUser && currentUser.friends) {
        // Convert friend IDs to strings for comparison
        const friendIds = currentUser.friends.map((id: ObjectId) => id.toString())
        // Filter users to only include friends
        const filteredUsers = users.filter(user => 
          friendIds.includes(user._id.toString())
        )
        users.length = 0 // Clear the array
        users.push(...filteredUsers) // Replace with filtered users
      }
    }
    
    // If userId is provided, sort users based on recent calls with this user
    if (userId) {
      const _userId = new ObjectId(userId)
      // Get call history from calls collection
      const calls = await db.collection('calls').find({
        $or: [
          { initiatorUserId: _userId },
          { targetUserId: _userId }
        ]
      }).sort({ _id: -1 }).toArray()
      
      // Create a map of user IDs to their most recent call timestamp with the specified user
      const userCallTimestamps = new Map()
      
      for (const call of calls) {
        const _otherUserId = call.initiatorUserId.equals(_userId) ? call.targetUserId : call.initiatorUserId
        const otherUserId = _otherUserId.toString()
        
        // Only set the timestamp if it's the first (most recent) occurrence of this user
        if (!userCallTimestamps.has(otherUserId)) {
          userCallTimestamps.set(otherUserId, call._id.getTimestamp())
        }
      }
      
      // Sort users based on call recency
      users.sort((a, b) => {
        const aTimestamp = userCallTimestamps.get(a._id.toString()) || 0
        const bTimestamp = userCallTimestamps.get(b._id.toString()) || 0
        return bTimestamp - aTimestamp
      })
    }
    
    const transformedUsers = users.map(transformUser)
    return transformedUsers
  },

  getOrCreateUser: async (_: any, { userId, defaultLanguages }: { userId: string, defaultLanguages: string[] }, { db }: Context) => {
    const _userId = userId ? new ObjectId(userId) : null
    let user = _userId ? await db.collection('users').findOne({ _id: _userId }) : null
    
    if (!user) {
      // Create new user with default values
      const newUser = {
        name: '',
        languages: defaultLanguages,  // Use provided default languages
        timestamp: Date.now(),
        locale: 'en',
        online: false,
        sex: '',  // Provide a default empty string instead of null
        blocks: [],
        friends: []  // Add empty friends array
      }
      
      // Insert the new user and get the result
      const result = await db.collection('users').insertOne(newUser)
      
      // Fetch the newly created user to ensure we have the correct document with the inserted ID
      user = await db.collection('users').findOne({ _id: result.insertedId })
    }

    const transformedUser = transformUser(user)
    if (!transformedUser) throw new Error('Failed to transform user')
    return transformedUser
  },
} 