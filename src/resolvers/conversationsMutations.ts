import { Context } from './types'
import { ObjectId } from 'mongodb'
import { MESSAGE_MAX_LENGTH } from './conversationsQueries'

export const conversationsMutations = {
  addMessage: async (
    _: any,
    { input }: { input: { targetUserId: string; message: string } },
    { db, session }: Context
  ) => {
    // Check if user is authenticated
    if (!session?.user?.id) {
      throw new Error('Authentication required')
    }

    const { targetUserId, message } = input
    const userId = new ObjectId(session.user.id)
    const _targetUserId = new ObjectId(targetUserId)

    // Validate message length
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty')
    }

    if (message.length > MESSAGE_MAX_LENGTH) {
      throw new Error(`Message cannot exceed ${MESSAGE_MAX_LENGTH} characters`)
    }

    // Prevent sending message to self
    if (userId.equals(_targetUserId)) {
      throw new Error('Cannot send message to yourself')
    }

    // Check if target user exists
    const targetUser = await db.collection('users').findOne({ _id: _targetUserId })
    if (!targetUser) {
      throw new Error('Target user not found')
    }

    const now = Date.now()

    // Find or create conversation
    let conversation = await db.collection('conversations').findOne({
      $or: [
        { user1Id: userId, user2Id: _targetUserId },
        { user1Id: _targetUserId, user2Id: userId }
      ]
    })

    if (!conversation) {
      // Create new conversation
      const newConversation = {
        user1Id: userId,
        user2Id: _targetUserId,
        blockedByUser1: false,
        blockedByUser2: false,
        createdAt: now,
        updatedAt: now
      }

      const result = await db.collection('conversations').insertOne(newConversation)
      conversation = { ...newConversation, _id: result.insertedId }
    } else {
      // Update conversation's updatedAt
      await db.collection('conversations').updateOne(
        { _id: conversation._id },
        { $set: { updatedAt: now } }
      )
    }

    // Create new message
    const newMessage = {
      conversationId: conversation._id,
      userId,
      message: message.trim(),
      createdAt: now,
      edited: false
    }

    const messageResult = await db.collection('messages').insertOne(newMessage)

    return {
      ...newMessage,
      _id: messageResult.insertedId
    }
  },

  editMessage: async (
    _: any,
    { input }: { input: { messageId: string; message: string } },
    { db, session }: Context
  ) => {
    // Check if user is authenticated
    if (!session?.user?.id) {
      throw new Error('Authentication required')
    }

    const { messageId, message } = input
    const userId = new ObjectId(session.user.id)
    const _messageId = new ObjectId(messageId)

    // Validate message length
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty')
    }

    if (message.length > MESSAGE_MAX_LENGTH) {
      throw new Error(`Message cannot exceed ${MESSAGE_MAX_LENGTH} characters`)
    }

    // Find the message and check ownership
    const existingMessage = await db.collection('messages').findOne({
      _id: _messageId,
      userId
    })

    if (!existingMessage) {
      throw new Error('Message not found or you do not own this message')
    }

    const now = Date.now()

    // Update the message
    await db.collection('messages').updateOne(
      { _id: _messageId },
      {
        $set: {
          message: message.trim(),
          updatedAt: now,
          edited: true
        }
      }
    )

    // Get the updated message
    const updatedMessage = await db.collection('messages').findOne({ _id: _messageId })

    return updatedMessage
  },

  deleteMessage: async (
    _: any,
    { messageId }: { messageId: string },
    { db, session }: Context
  ) => {
    // Check if user is authenticated
    if (!session?.user?.id) {
      throw new Error('Authentication required')
    }

    const userId = new ObjectId(session.user.id)
    const _messageId = new ObjectId(messageId)

    // Find the message and check ownership
    const existingMessage = await db.collection('messages').findOne({
      _id: _messageId,
      userId
    })

    if (!existingMessage) {
      throw new Error('Message not found or you do not own this message')
    }

    // Delete the message
    const result = await db.collection('messages').deleteOne({ _id: _messageId })

    return result.deletedCount > 0
  }
} 