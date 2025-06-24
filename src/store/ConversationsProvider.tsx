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

  return (
    <ConversationsContext.Provider value={{ conversations, loading, error, refetch }}>
      {children}
    </ConversationsContext.Provider>
  )
} 