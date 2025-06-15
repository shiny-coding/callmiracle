import { Context } from './types'
import { ObjectId } from 'mongodb'
import { GroupInput } from '@/generated/graphql'

const createOrUpdateGroup = async (_: any, { input }: { input: GroupInput }, { db }: Context) => {
  try {
    const { name, open, admins } = input
    const _groupId = input._id ? new ObjectId(input._id) : new ObjectId()
    
    const adminObjectIds = admins.map(id => new ObjectId(id))

    const $set = {
      name,
      open,
      admins: adminObjectIds
    }

    // Use upsert to either update existing or create new
    const group = await db.collection('groups').findOneAndUpdate(
      { _id: _groupId },
      {
        $set,
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    )
    
    return group
  } catch (error) {
    console.error('Error creating/updating group:', error)
    throw error
  }
}

export const groupsMutations = {
  createOrUpdateGroup
} 