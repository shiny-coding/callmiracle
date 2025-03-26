import { Context } from './types'
import { transformUser } from './utils'
import { ObjectId } from 'mongodb'

export const updateUserMutation = async (_: any, { input }: { input: any }, { db }: Context) => {
  const { _id, name, statuses, locale, languages, online, about, contacts, sex, birthYear, allowedMales, allowedFemales, allowedMinAge, allowedMaxAge, blocks } = input
  const timestamp = Date.now()

  const result = await db.collection('users').findOneAndUpdate(
    { _id: new ObjectId(_id) },
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
        blocks
      } 
    },
    { 
      upsert: true,
      returnDocument: 'after'
    }
  )

  if (!result) throw new Error('Failed to update user')

  const transformedUser = transformUser(result)
  if (!transformedUser) throw new Error('Failed to transform updated user')
  
  return transformedUser
}