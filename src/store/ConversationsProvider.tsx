'use client'

import { createContext, useContext, ReactNode } from 'react'
import { gql, useQuery } from '@apollo/client'
import { Conversation } from '@/generated/graphql'
import { useStore } from './useStore'

const GET_CONVERSATIONS = gql`
  query GetConversations {
    getConversations {
      _id
      user1Id
      user2Id
      blockedByUser1
      blockedByUser2
      createdAt
      updatedAt
      lastMessage
      user1LastSeenMessage
      user2LastSeenMessage
      user1 {
        _id
        name
      }
      user2 {
        _id
        name
      }
    }
  }
`

interface ConversationsContextType {
  conversations: Conversation[] | undefined
  loading: boolean
  error: any
  refetch: () => Promise<any>
  hasUnreadConversations: boolean
  hasUnreadMessages: (conversation: Conversation) => boolean
}

const ConversationsContext = createContext<ConversationsContextType | null>(null)

export function useConversations() {
  const context = useContext(ConversationsContext)
  if (!context) {
    throw new Error('useConversations must be used within a ConversationsProvider')
  }
  return context
}

interface ConversationsProviderProps {
  children: ReactNode
}

export function ConversationsProvider({ children }: ConversationsProviderProps) {
  const currentUser = useStore(state => state.currentUser)
  const { data, loading, error, refetch } = useQuery(GET_CONVERSATIONS, {
    skip: !currentUser?._id,
    pollInterval: 30000, // Poll every 30 seconds for new conversations
  })
  const conversations = data?.getConversations || []

  const hasUnreadMessages = (conversation: Conversation) => {
    if (!currentUser) return false
    
    // If there's no lastMessage, there are no messages
    if (!conversation.lastMessage) return false
    
    // Get the correct lastSeenMessage field for the current user
    const lastSeenMessage = conversation.user1Id === currentUser._id 
      ? conversation.user1LastSeenMessage 
      : conversation.user2LastSeenMessage
    
    // If there's no lastSeenMessage, there are unread messages
    if (!lastSeenMessage) return true
    
    // If lastMessage is different from lastSeenMessage, there are unread messages
    return conversation.lastMessage !== lastSeenMessage
  }

  const hasUnreadConversations = conversations?.some(hasUnreadMessages) || false

  return (
    <ConversationsContext.Provider value={{ 
      conversations, 
      loading, 
      error, 
      refetch, 
      hasUnreadConversations,
      hasUnreadMessages
    }}>
      {children}
    </ConversationsContext.Provider>
  )
} 