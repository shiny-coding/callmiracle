'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Paper, Typography, Box } from '@mui/material'
import MessageIcon from '@mui/icons-material/Message'
import { Conversation, User } from '@/generated/graphql'
import { useConversations, GET_CONVERSATIONS } from '@/store/ConversationsProvider'
import { useStore } from '@/store/useStore'
import LoadingDialog from '@/components/LoadingDialog'
import PageHeader from '@/components/PageHeader'
import MessagesList from '@/components/MessagesList'
import NotificationBadge from '@/components/NotificationBadge'
import UserAvatar from '@/components/UserAvatar'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { gql, useLazyQuery, useMutation } from '@apollo/client'
import clientLogger from '@/utils/clientLogger'

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

const SET_CURRENT_PAGE = gql`
  mutation SetCurrentPage($page: String!) {
    setCurrentPage(page: $page)
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
  const [markConversationRead] = useMutation(MARK_CONVERSATION_READ, {
    refetchQueries: [{ query: GET_CONVERSATIONS }],
    awaitRefetchQueries: true,
  })
  const [setCurrentPage] = useMutation(SET_CURRENT_PAGE)

  // Notify server that user is on conversations page (to skip push notifications)
  useEffect(() => {
    const updatePageStatus = () => {
      if (document.visibilityState === 'visible') {
        setCurrentPage({ variables: { page: '/conversations' } }).catch(() => {
          // Silent fail - not critical
        })
      } else {
        // App is hidden/minimized - clear page so push notifications are sent
        setCurrentPage({ variables: { page: '' } }).catch(() => {
          // Silent fail - not critical
        })
      }
    }

    // Set initial status
    updatePageStatus()

    // Listen for visibility changes (app minimized/restored)
    document.addEventListener('visibilitychange', updatePageStatus)

    // Clear page when component unmounts
    return () => {
      document.removeEventListener('visibilitychange', updatePageStatus)
      setCurrentPage({ variables: { page: '' } }).catch(() => {
        // Silent fail - not critical
      })
    }
  }, [setCurrentPage])

  // Listen for refresh conversation event (from push notification click when already on page)
  useEffect(() => {
    const handleRefreshConversation = () => {
      clientLogger.info('[ConversationsList] Refresh conversation event received')
      refetch()
    }

    window.addEventListener('refreshConversation', handleRefreshConversation)
    return () => {
      window.removeEventListener('refreshConversation', handleRefreshConversation)
    }
  }, [refetch])

  useEffect(() => {
    // Only auto-select a conversation on initial load
    if (!hasInitializedRef.current && !withUserId && sortedConversations.length > 0) {
      hasInitializedRef.current = true

      // Check if the stored lastConversationId exists in current conversations
      const lastConversation = lastConversationId
        ? sortedConversations.find(c => c._id === lastConversationId)
        : null

      const selectedId = lastConversation ? lastConversationId : sortedConversations[0]._id
      setSelectedConversationId(selectedId)

      // Mark the auto-selected conversation as read
      if (selectedId && !selectedId.startsWith('temp_')) {
        markConversationRead({
          variables: { conversationId: selectedId }
        }).catch(error => {
          console.error('Error marking auto-selected conversation as read:', error)
        })
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
  }, [sortedConversations, withUserId, lastConversationId, selectedConversationId, markConversationRead])

  // Track if we need to mark conversation as read after messages load
  const pendingMarkReadRef = useRef<string | null>(null)
  // Track if we've handled the withUserId param
  const handledWithUserIdRef = useRef<string | null>(null)

  // Reset handled ref when withUserId changes
  useEffect(() => {
    clientLogger.info('[ConversationsList] withUserId changed', {
      withUserId,
      handledWithUserIdRef: handledWithUserIdRef.current
    })
    if (withUserId !== handledWithUserIdRef.current) {
      handledWithUserIdRef.current = null
    }
  }, [withUserId])

  useEffect(() => {
    clientLogger.info('[ConversationsList] withUserId effect running', {
      withUserId,
      loading,
      handledWithUserIdRef: handledWithUserIdRef.current,
      conversationsLength: conversations?.length
    })

    // Skip if no withUserId or still loading
    if (!withUserId || loading) return

    // Skip if we've already handled this withUserId
    if (handledWithUserIdRef.current === withUserId) {
      clientLogger.info('[ConversationsList] Already handled this withUserId, skipping')
      return
    }

    if (conversations && conversations.length > 0) {
      const existingConvo = conversations.find(
        c => c.user1Id === withUserId || c.user2Id === withUserId
      )

      if (existingConvo) {
        clientLogger.info('[ConversationsList] Found conversation for withUserId', {
          conversationId: existingConvo._id,
          withUserId
        })
        handledWithUserIdRef.current = withUserId
        setSelectedConversationId(existingConvo._id)
        setTempConversation(null)
        // Mark this as initialized since we're selecting based on URL param
        hasInitializedRef.current = true

        // Don't mark as read immediately - wait for messages to load first
        // so we can highlight unread messages
        pendingMarkReadRef.current = existingConvo._id
      } else if (currentUser?._id !== withUserId) {
        // User not found in existing conversations, fetch their info
        clientLogger.info('[ConversationsList] User not in conversations, fetching', { withUserId })
        handledWithUserIdRef.current = withUserId
        getUser({ variables: { userId: withUserId } })
      }
    } else if (conversations && conversations.length === 0) {
      // Conversations loaded but empty - this is a new user, fetch their info
      if (currentUser?._id !== withUserId) {
        clientLogger.info('[ConversationsList] No conversations, fetching user', { withUserId })
        handledWithUserIdRef.current = withUserId
        getUser({ variables: { userId: withUserId } })
      }
    }
  }, [withUserId, conversations, loading, getUser, currentUser?._id])
  
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
        await refetch()
      } catch (error) {
        console.error('Error marking conversation as read:', error)
      }
    }
  }

  return (
    <Paper className="h-full flex flex-col">
      <PageHeader
        icon={<MessageIcon className="dimmer-text-color" />}
        title={t('conversations')}
      />

      {/* Horizontal scrollable conversations bar */}
      <Box className="border-b border-[--border-color]">
        <Box 
          className="flex overflow-x-auto"
          sx={{
            'padding': 'var(--10sp)',
            'gap': 'var(--10sp)',
            'backgroundColor': 'transparent',
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
                    isSelected ? '' : 'hover:bg-gray-700'
                  }`}
                  style={isSelected ? { border: '1px solid var(--icon-color-primary)', backgroundColor: 'transparent' } : undefined}
                  onClick={() => handleConversationSelect(conversation._id)}
                >
                  <NotificationBadge show={hasUnread && !isSelected}>
                    <UserAvatar
                      user={otherUser}
                      size="lg"
                      className="mb-1"
                    />
                  </NotificationBadge>
                  <Typography
                    variant="caption"
                    className={`text-center text-xs max-w-[70px] overflow-hidden text-ellipsis whitespace-nowrap text-color ${
                      isSelected ? 'font-medium' : ''
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
            onMessagesLoaded={() => {
              // Mark conversation as read after messages are loaded and highlighted
              if (pendingMarkReadRef.current === selectedConversationId) {
                pendingMarkReadRef.current = null
                markConversationRead({
                  variables: { conversationId: selectedConversationId }
                }).catch(error => {
                  console.error('Error marking conversation as read:', error)
                })
              }
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