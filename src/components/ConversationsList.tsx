'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Paper, Typography, IconButton, Avatar, Box } from '@mui/material'
import MessageIcon from '@mui/icons-material/Message'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Conversation, User } from '@/generated/graphql'
import { useConversations } from '@/store/ConversationsProvider'
import { useStore } from '@/store/useStore'
import LoadingDialog from '@/components/LoadingDialog'
import PageHeader from '@/components/PageHeader'
import MessagesList from '@/components/MessagesList'
import NotificationBadge from '@/components/NotificationBadge'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { gql, useLazyQuery, useMutation } from '@apollo/client'

const GET_USER = gql`
  query GetUser($userId: ID!) {
    getUser(userId: $userId) {
      _id
      name
    }
  }
`

const MARK_CONVERSATION_READ = gql`
  mutation MarkConversationRead($conversationId: ID!) {
    markConversationRead(conversationId: $conversationId)
  }
`

export default function ConversationsList() {
  const { conversations, loading, error, refetch, hasUnreadMessages } = useConversations()
  const t = useTranslations()
  const currentUser = useStore(state => state.currentUser)
  const lastConversationId = useStore(state => state.lastConversationId)
  const setLastConversationId = useStore(state => state.setLastConversationId)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [tempConversation, setTempConversation] = useState<Conversation | null>(null)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const withUserId = searchParams.get('with')
  
  // Track if we've done initial selection
  const hasInitializedRef = useRef(false)

  const allConversations = [...(conversations || [])]
  if (tempConversation && !allConversations.find(c => c.user1Id === tempConversation.user2Id || c.user2Id === tempConversation.user2Id)) {
    allConversations.unshift(tempConversation)
  }
  const sortedConversations = [...allConversations].sort((a, b) => b.updatedAt - a.updatedAt)

  const [getUser, { data: newUserData, loading: newUserLoading }] = useLazyQuery<{ getUser: User }>(GET_USER)
  const [markConversationRead] = useMutation(MARK_CONVERSATION_READ)

  useEffect(() => {
    // Only auto-select a conversation on initial load
    if (!hasInitializedRef.current && !withUserId && sortedConversations.length > 0) {
      hasInitializedRef.current = true
      
      // Check if the stored lastConversationId exists in current conversations
      const lastConversation = lastConversationId 
        ? sortedConversations.find(c => c._id === lastConversationId)
        : null
      
      if (lastConversation) {
        setSelectedConversationId(lastConversationId)
      } else {
        setSelectedConversationId(sortedConversations[0]._id)
      }
    }
    
    // If a conversation is selected but no longer exists in the list, clear the selection
    // (but don't auto-select another one to avoid unwanted switching)
    if (selectedConversationId && !selectedConversationId.startsWith('temp_') && sortedConversations.length > 0) {
      const selectedExists = sortedConversations.find(c => c._id === selectedConversationId)
      if (!selectedExists) {
        setSelectedConversationId(null)
      }
    }
  }, [sortedConversations, withUserId, lastConversationId, selectedConversationId])

  useEffect(() => {
    if (withUserId && conversations) {
      const existingConvo = conversations.find(
        c => c.user1Id === withUserId || c.user2Id === withUserId
      )
      
      if (existingConvo) {
        setSelectedConversationId(existingConvo._id)
        setTempConversation(null)
        // Mark this as initialized since we're selecting based on URL param
        hasInitializedRef.current = true
      } else if (currentUser?._id !== withUserId) {
        getUser({ variables: { userId: withUserId } })
      }
    }
  }, [withUserId, conversations, getUser, currentUser?._id])
  
  useEffect(() => {
    if (newUserData?.getUser && currentUser) {
      const tempConvo: Conversation = {
        _id: `temp_${newUserData.getUser._id}`,
        user1Id: currentUser._id,
        user2Id: newUserData.getUser._id,
        user1: currentUser as User,
        user2: newUserData.getUser,
        updatedAt: Date.now(),
        createdAt: Date.now(),
        blockedByUser1: false,
        blockedByUser2: false,
        lastMessage: null,
        user1LastSeenMessage: null,
        user2LastSeenMessage: null,
        __typename: 'Conversation',
      }
      setTempConversation(tempConvo)
      setSelectedConversationId(tempConvo._id)
      // Mark as initialized when creating temp conversation from URL param
      hasInitializedRef.current = true
    }
  }, [newUserData, currentUser])

  // TODO: Re-implement message notifications with proper debouncing once type issues are resolved
  // For now, we'll rely on the existing conversation refetch in ConversationsProvider

  if (loading || error || newUserLoading) return <LoadingDialog loading={loading || newUserLoading} error={error} />

  const getOtherUser = (conversation: Conversation) => {
    if (!currentUser) return null
    return conversation.user1Id === currentUser._id ? conversation.user2 : conversation.user1
  }

  const handleConversationSelect = async (conversationId: string) => {
    setSelectedConversationId(conversationId)
    
    // Store the selected conversation ID for future use (only for real conversations, not temp ones)
    if (!conversationId.startsWith('temp_')) {
      setLastConversationId(conversationId)
    }
    
    // Remove the 'with' parameter from URL when manually selecting a conversation
    if (withUserId) {
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('with')
      const newUrl = newSearchParams.toString() 
        ? `${pathname}?${newSearchParams.toString()}`
        : pathname
      router.replace(newUrl)
    }
    
    // Mark conversation as read if it's not a temp conversation
    if (!conversationId.startsWith('temp_')) {
      try {
        await markConversationRead({
          variables: { conversationId }
        })
        // Refetch conversations to update the UI
        refetch()
      } catch (error) {
        console.error('Error marking conversation as read:', error)
      }
    }
  }

  return (
    <Paper className="h-full flex flex-col">
      <PageHeader
        icon={<MessageIcon />}
        title={t('conversations')}
      >
        <IconButton 
          onClick={() => refetch()} 
          aria-label="refresh"
          title="Refresh"
          size="small"
        >
          <RefreshIcon />
        </IconButton>
      </PageHeader>

      {/* Horizontal scrollable conversations bar */}
      <Box className="border-b border-[--border-color] bg-gray-800">
        <Box 
          className="flex overflow-x-auto py-3 px-4 gap-3"
          sx={{
            '&::-webkit-scrollbar': {
              height: '6px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(255,255,255,0.3)',
              borderRadius: '3px',
            },
          }}
        >
          {sortedConversations.length === 0 ? (
            <Typography className="text-gray-400 text-sm px-2 py-4 whitespace-nowrap">
              {t('noConversationsYet')}
            </Typography>
          ) : (
            sortedConversations.map((conversation) => {
              const otherUser = getOtherUser(conversation)
              const isSelected = selectedConversationId === conversation._id
              const hasUnread = hasUnreadMessages(conversation)
              
              return (
                <Box
                  key={conversation._id}
                  className={`flex flex-col items-center cursor-pointer p-2 rounded-lg transition-colors min-w-[80px] ${
                    isSelected ? 'bg-blue-600' : 'hover:bg-gray-700'
                  }`}
                  onClick={() => handleConversationSelect(conversation._id)}
                >
                  <NotificationBadge show={hasUnread && !isSelected}>
                    <Avatar 
                      className="w-12 h-12 mb-1"
                      sx={{ 
                        backgroundColor: isSelected ? '#ffffff' : '#4b5563',
                        color: isSelected ? '#2563eb' : '#ffffff',
                        fontSize: '1rem' 
                      }}
                    >
                      {otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
                    </Avatar>
                  </NotificationBadge>
                  <Typography 
                    variant="caption" 
                    className={`text-center text-xs max-w-[70px] overflow-hidden text-ellipsis whitespace-nowrap ${
                      isSelected ? 'text-white font-medium' : 'text-gray-300'
                    }`}
                    title={otherUser?.name || 'Unknown'}
                  >
                    {otherUser?.name || 'Unknown'}
                  </Typography>
                </Box>
              )
            })
          )}
        </Box>
      </Box>

      {/* Messages area */}
      <div className="flex-grow overflow-hidden">
        {selectedConversationId ? (
          <MessagesList 
            conversationId={selectedConversationId} 
            onMessageSent={() => {
              refetch() // Refetch conversations
              setTempConversation(null) // Clear temp conversation
            }}

          />
        ) : (
          <Box className="flex items-center justify-center h-full">
            <Typography className="text-gray-500 text-center">
              {sortedConversations.length > 0 
                ? t('selectConversationToViewMessages')
                : t('startConversationToSeeMessages')
              }
            </Typography>
          </Box>
        )}
      </div>
    </Paper>
  )
} 