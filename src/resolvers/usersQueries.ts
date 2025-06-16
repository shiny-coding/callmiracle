import { Context } from './types'
import { ObjectId } from 'mongodb'

export const usersQueries = {
  getUsers: async (_: any, {}: any, { db, session }: Context) => {
    // Check if user is authenticated
    if (!session?.user?.id) {
      throw new Error('Authentication required')
    }
    
    const _userId = new ObjectId(session.user.id)
    
    // Get the current user to find their groups
    const currentUser = await db.collection('users').findOne({ _id: _userId })
    if (!currentUser) {
      throw new Error('Current user not found')
    }
    
    // Get all users from groups that the current user belongs to
    let users: any[] = []
    if (currentUser.groups && currentUser.groups.length > 0) {
      users = await db.collection('users').find({
        groups: { $in: currentUser.groups }
      }).sort({ timestamp: -1 }).toArray()
    }
    
    // Add filter to exclude deleted users
    return users.filter(user => !user.deleted)
  },

  getUser: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    try {
      const _id = new ObjectId(userId)
      // Add filter to exclude deleted users
      return await db.collection('users').findOne({ _id })
    } catch (error) {
      console.error('Error fetching user:', error)
      return null
    }
  },
} 