import { Context } from './types'
import { ObjectId } from 'mongodb'
import { AuthenticationError, NotFoundError, handleDatabaseError } from '@/utils/error'

export const usersQueries = {
  getUsers: async (_: any, {}: any, { db, session, logger }: Context) => {
    // Check if user is authenticated
    if (!session?.user?.id) {
      logger.warn('Unauthenticated attempt to access users')
      throw new AuthenticationError()
    }
    
    const _userId = new ObjectId(session.user.id)
    logger.info('Fetching users for authenticated user', { userId: session.user.id })
    
    try {
      // Get the current user to find their groups
      const currentUser = await db.collection('users').findOne({ _id: _userId })
      if (!currentUser) {
        logger.error('Current user not found in database', { userId: session.user.id })
        throw new NotFoundError('Current user')
      }
      
      // Get all users from groups that the current user belongs to
      let users: any[] = []
      if (currentUser.groups && currentUser.groups.length > 0) {
        logger.debug('Fetching users from user groups', { 
          groupCount: currentUser.groups.length,
          groups: currentUser.groups.map((g: any) => g.toString())
        })
        
        users = await db.collection('users').find({
          groups: { $in: currentUser.groups }
        }).sort({ timestamp: -1 }).toArray()
        
        logger.info('Successfully fetched users', { 
          totalUsers: users.length,
          filteredUsers: users.filter(user => !user.deleted).length
        })
      } else {
        logger.info('User has no groups, returning empty user list')
      }
      
      // Add filter to exclude deleted users
      const activeUsers = users.filter(user => !user.deleted)
      
      logger.info('Users query completed', { 
        activeUsers: activeUsers.length,
        deletedUsers: users.length - activeUsers.length
      })
      
      return activeUsers
    } catch (error) {
      handleDatabaseError(error, 'getUsers', 'users')
    }
  },

  getUser: async (_: any, { userId }: { userId: string }, { db, logger }: Context) => {
    logger.info('Fetching single user', { targetUserId: userId })
    
    try {
      const _id = new ObjectId(userId)
      const user = await db.collection('users').findOne({ _id })
      
      if (!user) {
        logger.warn('User not found', { targetUserId: userId })
        return null
      }
      
      if (user.deleted) {
        logger.info('Requested user is deleted', { targetUserId: userId })
        return null
      }
      
      logger.info('Successfully fetched user', { 
        targetUserId: userId,
        userName: user.name
      })
      
      return user
    } catch (error) {
      logger.error('Error fetching user', { 
        targetUserId: userId,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  },
} 