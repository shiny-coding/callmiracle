import { Context } from './types'
import { transformUser } from './utils'
import { User } from '@/generated/graphql'
import { ObjectId } from 'mongodb'

export const usersQueries = {
  users: async (_: any, __: any, { db }: Context) => {
    const users = await db.collection('users').find().sort({ timestamp: -1 }).toArray()
    const transformedUsers = users.map(transformUser).filter((user): user is User => user !== null)
    return transformedUsers
  },

  getOrCreateUser: async (_: any, { userId, defaultLanguages }: { userId: string, defaultLanguages: string[] }, { db }: Context) => {
    let user = await db.collection('users').findOne({ userId })
    
    if (!user) {
      // Create new user with default values
      const newUser = {
        _id: new ObjectId(),
        userId,
        name: '',
        statuses: [],
        languages: defaultLanguages,  // Use provided default languages
        timestamp: Date.now(),
        locale: 'en',
        online: false,
        allowedMales: true,
        allowedFemales: true,
        allowedMinAge: 10,
        allowedMaxAge: 100,
        blocks: []
      }
      
      await db.collection('users').insertOne(newUser)
      user = newUser
    }

    const transformedUser = transformUser(user)
    if (!transformedUser) throw new Error('Failed to transform user')
    return transformedUser
  },

} 