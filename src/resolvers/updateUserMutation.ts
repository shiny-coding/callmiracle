import { Context } from './types'
import { transformUser } from './utils'
import { User } from '@/generated/graphql'
import { pubsub } from './pubsub'

export const updateUserMutation = async (_: any, { input }: { input: any }, { db }: Context) => {
  const { userId, name, statuses, locale, languages, online, about, contacts, sex, birthYear, allowedMales, allowedFemales, allowedMinAge, allowedMaxAge, blocks } = input
  const timestamp = Date.now()

  const result = await db.collection('users').findOneAndUpdate(
    { userId },
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

  // Get updated user list and publish
  const users = await db.collection('users').find().toArray()
  const transformedUsers = users.map(transformUser).filter((user): user is User => user !== null)

  pubsub.publish('USERS_UPDATED', transformedUsers)
  console.log('Publishing users updated: ' + transformedUsers.length)

  return transformedUser
}