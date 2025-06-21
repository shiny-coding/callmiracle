import { Context } from './types'
import { ObjectId } from 'mongodb'
import { GroupInput } from '@/generated/graphql'
import { randomBytes } from 'crypto'

const createOrUpdateGroup = async (_: any, { input }: { input: GroupInput }, { db, session }: Context) => {
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  const _userId = new ObjectId(session.user.id)

  try {
    // Remove __typename from nested objects
    const { name, description, open, transparency, admins, interestsPairs, interestsDescriptions } = input
    const _groupId = input._id ? new ObjectId(input._id) : new ObjectId()
    
    const _adminIds = admins.map(id => new ObjectId(id))

    const $set: any = {
      name,
      description,
      open,
      transparency,
      admins: _adminIds,
      interestsPairs: interestsPairs || [],
      interestsDescriptions: interestsDescriptions || []
    }

    // Check if group already exists to determine if it's a new group
    const existingGroup = await db.collection('groups').findOne({ _id: _groupId })
    const isNewGroup = !existingGroup

    // For updates, if we don't have a token or if this is triggered by a token generation request, create one
    const needsNewToken = isNewGroup || (!existingGroup?.joinToken)

    if (needsNewToken) {
      const joinToken = randomBytes(32).toString('hex')
      $set.joinToken = joinToken
    }

    // Use upsert to either update existing or create new
    const group = await db.collection('groups').findOneAndUpdate(
      { _id: _groupId },
      {
        $set,
        $setOnInsert: {
          createdAt: new Date(),
          owner: _userId
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

const regenerateJoinToken = async (_: any, { groupId }: { groupId: string }, { db, session }: Context) => {
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  const _userId = new ObjectId(session.user.id)
  const _groupId = new ObjectId(groupId)

  try {
    // Check if the group exists and if the user is the owner or admin
    const group = await db.collection('groups').findOne({ _id: _groupId })
    
    if (!group) {
      throw new Error('Group not found')
    }

    // Check if user is owner or admin
    const isOwner = group.owner.equals(_userId)
    const isAdmin = group.admins.some((adminId: ObjectId) => adminId.equals(_userId))
    
    if (!isOwner && !isAdmin) {
      throw new Error('Only group owners and administrators can regenerate join tokens')
    }

    // Generate new join token
    const joinToken = randomBytes(32).toString('hex')

    // Update the group with the new join token
    const updatedGroup = await db.collection('groups').findOneAndUpdate(
      { _id: _groupId },
      { $set: { joinToken } },
      { returnDocument: 'after' }
    )

    return updatedGroup
  } catch (error) {
    console.error('Error regenerating join token:', error)
    throw error
  }
}

const removeUserFromGroup = async (_: any, { groupId, userId }: { groupId: string, userId: string }, { db, session }: Context) => {
  if (!session?.user) {
    throw new Error('Authentication required')
  }

  const _currentUserId = new ObjectId(session.user.id)
  const _groupId = new ObjectId(groupId)
  const _userToRemoveId = new ObjectId(userId)

  try {
    // Check if the group exists and if the current user is the owner or admin
    const group = await db.collection('groups').findOne({ _id: _groupId })
    
    if (!group) {
      throw new Error('Group not found')
    }

    // Check if current user is owner or admin
    const isOwner = group.owner.equals(_currentUserId)
    const isAdmin = group.admins.some((adminId: ObjectId) => adminId.equals(_currentUserId))
    
    if (!isOwner && !isAdmin) {
      throw new Error('Only group owners and administrators can remove users from the group')
    }

    // Prevent removing the group owner
    if (group.owner.equals(_userToRemoveId)) {
      throw new Error('Cannot remove the group owner from the group')
    }

    // Remove the group from user's groups array
    const result = await db.collection('users').updateOne(
      { _id: _userToRemoveId },
      { $pull: { groups: _groupId } } as any
    )

    if (result.modifiedCount === 0) {
      throw new Error('User was not in the group or removal failed')
    }

    // If the user being removed is an admin, also remove them from the admins array
    await db.collection('groups').updateOne(
      { _id: _groupId },
      { $pull: { admins: _userToRemoveId } } as any
    )

    return true
  } catch (error) {
    console.error('Error removing user from group:', error)
    throw error
  }
}

export default {
  createOrUpdateGroup,
  regenerateJoinToken,
  removeUserFromGroup,
  deleteGroup
} 