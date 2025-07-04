import { Context } from './types'
import { ObjectId } from 'mongodb'

export const groupsQueries = {
  getGroups: async (_: any, { userId }: { userId: string }, { db }: Context) => {
    try {
      const _userId = new ObjectId(userId)
      
      // Get all groups (you may want to add filtering based on user permissions later)
      const groups = await db.collection('groups')
        .find({
          // For now, return all groups. You could add filters here like:
          // $or: [
          //   { open: true }, // Open groups everyone can see
          //   { members: _userId }, // Groups the user is already in
          //   { admins: _userId } // Groups the user is admin of
          // ]
        })
        .sort({ name: 1 }) // Sort by name alphabetically
        .toArray()
      
      // For each group, count how many users have this group in their groups array
      const groupsWithUsersCount = await Promise.all(groups.map(async (group) => {
        const usersCount = await db.collection('users').countDocuments({
          groups: { $in: [group._id] }
        })
        
        return {
          ...group,
          _id: group._id.toString(),
          usersCount
        }
      }))
      
      return groupsWithUsersCount
    } catch (error) {
      console.error('Error fetching groups:', error)
      throw new Error('Failed to fetch groups')
    }
  }
} 