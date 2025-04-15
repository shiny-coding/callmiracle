import { Context } from './types'
import { ObjectId } from 'mongodb'
import { GraphQLError } from 'graphql'

export const deleteUserMutation = async (
  _: any,
  { userId }: { userId: string },
  { db, session }: Context
) => {
  if (!session?.user?.id) {
    throw new GraphQLError('User is not authenticated', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    })
  }

  if (session.user.id !== userId) {
    throw new GraphQLError('User is not authorized to delete this account', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    })
  }

  try {
    const _id = new ObjectId(userId)
    
    // Update user to mark as deleted instead of removing
    const result = await db.collection('users').updateOne(
      { _id },
      { 
        $set: { 
          deleted: true,
          deletedAt: new Date(),
          // Anonymize user data
          name: 'Deleted User',
          email: `deleted_${_id}@example.com`,
          about: '',
          contacts: '',
          // Keep minimal data for record-keeping
        } 
      }
    )
    
    if (result.matchedCount === 0) {
      throw new GraphQLError('User not found', {
        extensions: {
          code: 'NOT_FOUND',
          http: { status: 404 },
        },
      })
    }
    
    return true
  } catch (error) {
    console.error('Error marking user as deleted:', error)
    if (error instanceof GraphQLError) {
      throw error
    }
    throw new GraphQLError('An internal error occurred during user deletion.', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    })
  }
} 