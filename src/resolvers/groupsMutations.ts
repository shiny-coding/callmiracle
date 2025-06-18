import { Context } from './types'
import { ObjectId } from 'mongodb'
import { GroupInput } from '@/generated/graphql'

const createOrUpdateGroup = async (_: any, { input }: { input: GroupInput }, { db, session }: Context) => {
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  const _userId = new ObjectId(session.user.id)

  try {
    // Remove __typename from nested objects
    const { name, description, open, admins, interestsPairs, interestsDescriptions } = input
    const _groupId = input._id ? new ObjectId(input._id) : new ObjectId()
    
    const _adminIds = admins.map(id => new ObjectId(id))

    const $set = {
      name,
      description,
      open,
      admins: _adminIds,
      interestsPairs: interestsPairs || [],
      interestsDescriptions: interestsDescriptions || []
    }

    // Check if group already exists to determine if it's a new group
    const existingGroup = await db.collection('groups').findOne({ _id: _groupId })
    const isNewGroup = !existingGroup

    // Use upsert to either update existing or create new
    const group = await db.collection('groups').findOneAndUpdate(
      { _id: _groupId },
      {
        $set,
        $setOnInsert: {
          createdAt: new Date(),
          owner: _userId,
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    )
    
    // Add the group to the user's groups array only if it's a newly created group
    if (isNewGroup) {
      await db.collection('users').updateOne(
        { _id: _userId },
        { $addToSet: { groups: new ObjectId(group?._id) } }
      )
    }
    
    return group
  } catch (error) {
    console.error('Error creating/updating group:', error)
    throw error
  }
}

const deleteGroup = async (_: any, { id }: { id: string }, { db, session }: Context) => {
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  const _id = new ObjectId(id)
  const _userId = new ObjectId(session.user.id)

  try {
    // First check if the group exists and if the user is the owner
    const group = await db.collection('groups').findOne({ _id })
    
    if (!group) {
      throw new Error('Group not found')
    }

    if (!group.owner.equals(_userId)) {
      throw new Error('Only the group owner can delete the group')
    }

    // Delete the group
    const result = await db.collection('groups').deleteOne({ _id })
    
    if (result.deletedCount === 0) {
      throw new Error('Failed to delete group')
    }

    // Remove the group from all users' groups arrays
    await db.collection('users').updateMany(
      { groups: { $in: [_id] } },
      { $pull: { groups: _id } } as any
    )

    return true
  } catch (error) {
    console.error('Error deleting group:', error)
    throw error
  }
}

export const groupsMutations = {
  createOrUpdateGroup,
  deleteGroup
} 