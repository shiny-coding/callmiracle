import { Context } from './types'
import { ObjectId } from 'mongodb'

export const updateUserMutation = async (_: any, { input }: { input: any }, { db }: Context) => {
  const { name, interests, languages, online, about, contacts, sex, birthYear, allowedMales, allowedFemales, allowedMinAge, allowedMaxAge, blocks, friends } = input
  const _id = new ObjectId(input._id)

  const user = await db.collection('users').findOneAndUpdate(
    { _id },
    { 
      $set: { 
        name, 
        interests, 
        updatedAt: Date.now(),
        languages,
        online,
        about,
        contacts,
        sex,
        birthYear,
        allowedMales,
        allowedFemales,
        allowedMinAge,
        allowedMaxAge,
        blocks,
        friends
      } 
    },
    { 
      upsert: false,
      returnDocument: 'after'
    }
  )

  if (!user) throw new Error('Failed to update user')

  return user
}