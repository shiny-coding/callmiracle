import { Context } from './types'
import { ObjectId } from 'mongodb'

// Constants for pagination and limits
export const MESSAGES_PER_PAGE = 50
export const MESSAGE_MAX_LENGTH = 1000

export const conversationsQueries = {
  getConversations: async (_: any, {}: any, { db, session }: Context) => {
    // Check if user is authenticated
    if (!session?.user?.id) {
      throw new Error('Authentication required')
    }
    
    const userId = new ObjectId(session.user.id)
    
    // Find all conversations where the user is either user1 or user2
    const conversations = await db.collection('conversations').find({
      $or: [
        { user1Id: userId },
        { user2Id: userId }
      ]
    }).sort({ updatedAt: -1 }).toArray()
    
    // Populate user data for each conversation
    const populatedConversations = await Promise.all(
      conversations.map(async (conversation) => {
        const user1 = await db.collection('users').findOne({ _id: conversation.user1Id })
        const user2 = await db.collection('users').findOne({ _id: conversation.user2Id })
        
        return {
          ...conversation,
          user1,
          user2
        }
      })
    )
    
    return populatedConversations
  },

  getMessages: async (
    _: any, 
    { conversationId, beforeId }: { conversationId: string; beforeId?: string }, 
    { db, session }: Context
  ) => {
    // Check if user is authenticated
    if (!session?.user?.id) {
      throw new Error('Authentication required')
    }
    
    const userId = new ObjectId(session.user.id)
    const _conversationId = new ObjectId(conversationId)
    
    // Check if user is part of this conversation
    const conversation = await db.collection('conversations').findOne({
      _id: _conversationId,
      $or: [
        { user1Id: userId },
        { user2Id: userId }
      ]
    })
    
    if (!conversation) {
      throw new Error('Conversation not found or access denied')
    }
    
    // Build query for messages
    const query: any = { conversationId: _conversationId }
    
    // Add pagination if beforeId is provided
    if (beforeId) {
      query._id = { $lt: new ObjectId(beforeId) }
    }
    
    // Get messages with pagination
    const messages = await db.collection('messages')
      .find(query)
      .sort({ _id: -1 }) // Sort by newest first
      .limit(MESSAGES_PER_PAGE)
      .toArray()
    
    return messages
  }
} 