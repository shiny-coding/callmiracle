import { Context } from './types'
import { ObjectId } from 'mongodb'

export const updateUserMutation = async (_: any, { input }: { input: any }, { db }: Context) => {
  const { name, statuses, locale, languages, online, about, contacts, sex, birthYear, allowedMales, allowedFemales, allowedMinAge, allowedMaxAge, blocks, friends } = input
  const _id = new ObjectId(input._id)
  const timestamp = Date.now()

  const user = await db.collection('users').findOneAndUpdate(
    { _id },
    { 
      $set: { 
        name, 
        statuses, 
        timestamp,
        locale,
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
      upsert: true,
      returnDocument: 'after'
    }
  )

  if (!user) throw new Error('Failed to update user')

  return user
}