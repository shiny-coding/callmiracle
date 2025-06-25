import { Context } from './types'
import { ObjectId } from 'mongodb'
import { MESSAGE_MAX_LENGTH } from './conversationsQueries'
import { publishPushNotification } from './pushNotifications'
import { NotificationType } from '@/generated/graphql'

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

    // Get current user for push notification
    const currentUser = await db.collection('users').findOne({ _id: userId })
    if (!currentUser) {
      throw new Error('Current user not found')
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
        updatedAt: now,
        lastMessage: null,
        user1LastSeenMessage: null,
        user2LastSeenMessage: null
      }

      const result = await db.collection('conversations').insertOne(newConversation)
      conversation = { ...newConversation, _id: result.insertedId }
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
    const messageId = messageResult.insertedId

    // Update conversation with new message and timestamps
    const updateFields: any = {
      updatedAt: now,
      lastMessage: messageId,
    }
    
    // Update lastSeenMessage for the sender
    if (conversation.user1Id.equals(userId)) {
      updateFields.user1LastSeenMessage = messageId
    } else if (conversation.user2Id.equals(userId)) {
      updateFields.user2LastSeenMessage = messageId
    }

    await db.collection('conversations').updateOne(
      { _id: conversation._id },
      { $set: updateFields }
    )

    // Send push notification to the target user
    try {
      const truncatedMessage = message.length > 100 ? message.substring(0, 100) + '...' : message
      await publishPushNotification(db, targetUser, {
        type: NotificationType.MessageReceived,
        peerUserName: currentUser.name,
        messageText: truncatedMessage,
        conversationId: conversation._id,
        senderUserId: userId
      })
    } catch (error) {
      console.error('Error sending push notification:', error)
      // Don't fail the message send if push notification fails
    }

    return {
      ...newMessage,
      _id: messageId
    }
  },

  markConversationRead: async (
    _: any,
    { conversationId }: { conversationId: string },
    { db, session }: Context
  ) => {
    // Check if user is authenticated
    if (!session?.user?.id) {
      throw new Error('Authentication required')
    }

    const userId = new ObjectId(session.user.id)
    const _conversationId = new ObjectId(conversationId)

    // Find the conversation and check if user is part of it
    const conversation = await db.collection('conversations').findOne({
      _id: _conversationId,
      $or: [
        { user1Id: userId },
        { user2Id: userId }
      ]
    })

    if (!conversation) {
      throw new Error('Conversation not found or you are not part of this conversation')
    }

    // Get the last message in this conversation
    const lastMessage = await db.collection('messages')
      .findOne(
        { conversationId: _conversationId },
        { sort: { createdAt: -1 } }
      )

    if (!lastMessage) {
      // No messages in conversation, nothing to mark as read
      return true
    }

    // Update conversation's lastSeenMessage for this user
    const updateField = conversation.user1Id.equals(userId) 
      ? 'user1LastSeenMessage' 
      : 'user2LastSeenMessage'

    await db.collection('conversations').updateOne(
      { _id: _conversationId },
      { 
        $set: { 
          [updateField]: lastMessage._id
        } 
      }
    )

    return true
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