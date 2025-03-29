import { Context } from './types'
import { transformUser } from './utils'
import { ObjectId } from 'mongodb'

export const usersQueries = {
  getUsers: async (_: any, __: any, { db }: Context) => {
    const users = await db.collection('users').find().sort({ timestamp: -1 }).toArray()
    const transformedUsers = users.map(transformUser)
    return transformedUsers
  },

  getOrCreateUser: async (_: any, { userId, defaultLanguages }: { userId: string, defaultLanguages: string[] }, { db }: Context) => {
    let user = userId ? await db.collection('users').findOne({ _id: new ObjectId(userId) }) : null
    
    if (!user) {
      // Create new user with default values
      const newUser = {
        name: '',
        languages: defaultLanguages,  // Use provided default languages
        timestamp: Date.now(),
        locale: 'en',
        online: false,
        sex: '',  // Provide a default empty string instead of null
        blocks: []
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