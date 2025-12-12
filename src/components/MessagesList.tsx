'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Box, 
  Typography, 
  IconButton, 
  Avatar,
  CircularProgress,
  Paper
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { gql, useQuery, useMutation, useApolloClient, NetworkStatus } from '@apollo/client'
import clientLogger from '@/utils/clientLogger'
import { Message, Conversation } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { useConversations } from '@/store/ConversationsProvider'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { formatTextWithLinks } from '../utils/formatTextWithLinks'
import { MESSAGES_PER_PAGE } from '@/config/constants'
import { useSubscriptions } from '@/contexts/SubscriptionsContext'
import { NotificationType } from '@/generated/graphql'

export const GET_MESSAGES_QUERY = 'getMessages'

const GET_MESSAGES = gql`
  query GetMessages($conversationId: ID!, $beforeId: ID, $afterId: ID) {
    ${GET_MESSAGES_QUERY}(conversationId: $conversationId, beforeId: $beforeId, afterId: $afterId) {
      _id
      conversationId
      userId
      message
      createdAt
      updatedAt
      edited
    }
  }
`

const ADD_MESSAGE = gql`
  mutation AddMessage($input: AddMessageInput!) {
    addMessage(input: $input) {
      _id
      conversationId
      userId
      message
      createdAt
      updatedAt
      edited
    }
  }
`

interface MessagesListProps {
  conversationId: string;
  onMessageSent?: () => void;
  onLoadNewMessages?: (loadNewMessages: () => Promise<void>) => void;
  onMessagesLoaded?: () => void;
}

export default function MessagesList({ conversationId, onMessageSent, onLoadNewMessages, onMessagesLoaded }: MessagesListProps) {
  const t = useTranslations()
  const currentUser = useStore(state => state.currentUser)
  const { conversations } = useConversations()
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [loadingNewer, setLoadingNewer] = useState(false)
  const [pendingLoadNewMessages, setPendingLoadNewMessages] = useState(false)
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set())

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLDivElement>(null)
  const isFirstLoad = useRef(true)

  const { subscribeToNotifications } = useSubscriptions()
  const client = useApolloClient()

  const isTempConversation = conversationId.startsWith('temp_');

  const currentConversation = conversations?.find(conv => conv._id === conversationId);

  let otherUserId: string | null = null;
  if (isTempConversation) {
    otherUserId = conversationId.replace('temp_', '');
  } else {
    otherUserId = currentConversation
        ? (currentConversation.user1Id === currentUser?._id
            ? currentConversation.user2Id
            : currentConversation.user1Id)
        : null;
  }

  // Get the lastSeenMessage for the current user to determine which messages are "new"
  const lastSeenMessageId = currentConversation
    ? (currentConversation.user1Id === currentUser?._id
        ? currentConversation.user1LastSeenMessage
        : currentConversation.user2LastSeenMessage)
    : null;

  // Query for initial messages
  const { data, loading, error, fetchMore, refetch, networkStatus } = useQuery(GET_MESSAGES, {
    variables: { conversationId },
    skip: isTempConversation,
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => {
      if (data?.getMessages) {
        setMessages(data.getMessages)
        setHasMore(data.getMessages.length === MESSAGES_PER_PAGE)

        // Mark unread messages (messages from others that are after lastSeenMessage) as new
        if (isFirstLoad.current && lastSeenMessageId) {
          const unreadMessageIds = new Set<string>()
          for (const msg of data.getMessages) {
            // Only highlight messages from the other user
            if (msg.userId !== currentUser?._id) {
              // Messages are sorted newest first, so we need to check if this message
              // comes after the lastSeenMessage (has a greater _id in MongoDB ObjectId order)
              if (msg._id > lastSeenMessageId) {
                unreadMessageIds.add(msg._id)
              }
            }
          }
          if (unreadMessageIds.size > 0) {
            setNewMessageIds(unreadMessageIds)
          }
        }

        // Scroll to bottom on initial load
        if (isFirstLoad.current) {
          // Use requestAnimationFrame to ensure DOM has rendered, then scroll
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollToBottom()
              isFirstLoad.current = false
              // Notify parent that messages are loaded (for marking as read)
              if (onMessagesLoaded) {
                onMessagesLoaded()
              }
            })
          })
        }
      }
    }
  })

  const [addMessage] = useMutation(ADD_MESSAGE, {
    onCompleted: (data) => {
      setIsSending(false)
      if (messageInputRef.current) {
        messageInputRef.current.textContent = ''
      }
      setMessageText('')
      
      if (data?.addMessage) {
        if (!isTempConversation) {
          setMessages(prev => [data.addMessage, ...prev])
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollToBottom()
            })
          })
        }
        
        if (onMessageSent) {
          onMessageSent()
        }
      }
    },
    onError: (error) => {
      console.error('Error sending message:', error)
      setIsSending(false)
    }
  })

  // Reset messages when conversation changes
  useEffect(() => {
    setMessages([])
    setNewMessageIds(new Set())
    isFirstLoad.current = true
    setHasMore(!isTempConversation)
  }, [conversationId, isTempConversation])

  // Listen for refresh conversation event (from push notification click when already on page)
  useEffect(() => {
    const handleRefreshConversation = async () => {
      // Capture current message IDs before refetch to detect truly new messages
      const existingMessageIds = new Set(messages.map(m => m._id))

      clientLogger.info('Messages', 'Refresh conversation event received, refetching messages', {
        conversationId,
        currentMessagesCount: messages.length,
        newestMessageId: messages[0]?._id
      })

      // Evict ALL getMessages cache entries to force fresh fetch
      client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'getMessages'
      })
      client.cache.gc()

      // Force network fetch
      const result = await refetch({ conversationId })

      clientLogger.info('Messages', 'Messages refetched', {
        newMessagesCount: result.data?.getMessages?.length,
        firstMessageId: result.data?.getMessages?.[0]?._id
      })

      // Update messages state and highlight only truly new messages
      if (result.data?.getMessages) {
        const fetchedMessages = result.data.getMessages
        setMessages(fetchedMessages)

        // Find messages that are new (not in our previous set) and from the other user
        const trulyNewIds = new Set<string>()
        for (const msg of fetchedMessages) {
          if (!existingMessageIds.has(msg._id) && msg.userId !== currentUser?._id) {
            trulyNewIds.add(msg._id)
          }
        }

        if (trulyNewIds.size > 0) {
          // Add to existing highlights rather than replacing
          setNewMessageIds(prev => {
            const updated = new Set(prev)
            for (const id of trulyNewIds) {
              updated.add(id)
            }
            return updated
          })
          clientLogger.info('Messages', 'New messages highlighted', {
            count: trulyNewIds.size,
            ids: Array.from(trulyNewIds)
          })
        }

        // Scroll to bottom to show new messages - use double rAF to ensure DOM has rendered
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom()
          })
        })
      }
    }

    window.addEventListener('refreshConversation', handleRefreshConversation)
    return () => {
      window.removeEventListener('refreshConversation', handleRefreshConversation)
    }
  }, [refetch, conversationId, messages, client, currentUser?._id])

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

  // Track distance from bottom for keyboard show/hide handling
  const distanceFromBottomRef = useRef(0)

  // Update distance from bottom on every scroll
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const updateDistanceFromBottom = () => {
      distanceFromBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight
    }

    container.addEventListener('scroll', updateDistanceFromBottom)
    // Initialize
    updateDistanceFromBottom()

    return () => {
      container.removeEventListener('scroll', updateDistanceFromBottom)
    }
  }, [messages]) // Re-attach when messages change

  // Handle iOS keyboard show/hide - maintain scroll position relative to bottom
  useEffect(() => {
    if (!window.visualViewport) return

    const handleViewportResize = () => {
      const container = messagesContainerRef.current
      if (container) {
        // Restore the same distance from bottom after resize
        const newScrollTop = container.scrollHeight - container.clientHeight - distanceFromBottomRef.current
        container.scrollTop = Math.max(0, newScrollTop)
      }
    }

    window.visualViewport.addEventListener('resize', handleViewportResize)

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize)
    }
  }, [])

  const handleScroll = useCallback(async () => {
    if (!messagesContainerRef.current || loadingMore || !hasMore || isTempConversation) return

    const container = messagesContainerRef.current
    const { scrollTop, scrollHeight } = container
    
    // Load more messages when scrolled near the top
    if (scrollTop < 100) {
      setLoadingMore(true)
      
      // Store current scroll position for restoration
      const previousScrollHeight = scrollHeight
      
      const oldestMessage = messages[messages.length - 1]
      if (oldestMessage) {
        try {
          await fetchMore({
            variables: {
              conversationId,
              beforeId: oldestMessage._id
            },
            updateQuery: (prev, { fetchMoreResult }) => {
              if (!fetchMoreResult?.getMessages?.length) {
                setHasMore(false)
                return prev
              }
              
              const newMessages = fetchMoreResult.getMessages
              const updatedMessages = [...messages, ...newMessages]
              setMessages(updatedMessages)
              setHasMore(newMessages.length === MESSAGES_PER_PAGE)
              
              // Restore scroll position after new messages are added
              setTimeout(() => {
                if (container) {
                  const newScrollHeight = container.scrollHeight
                  const scrollDifference = newScrollHeight - previousScrollHeight
                  container.scrollTop = scrollTop + scrollDifference
                }
              }, 50)
              
              // Return the updated query structure
              return {
                ...prev,
                getMessages: updatedMessages
              }
            }
          })
        } catch (error) {
          console.error('Error loading more messages:', error)
        }
      }
      
      setLoadingMore(false)
    }
  }, [messages, loadingMore, hasMore, fetchMore, conversationId, isTempConversation])

  const loadNewMessages = useCallback(async () => {
    if (!messages.length || isTempConversation) return

    // If already loading, mark that we need to load again after current load
    if (loadingNewer) {
      setPendingLoadNewMessages(true)
      return
    }

    setLoadingNewer(true)
    setPendingLoadNewMessages(false)

    const newestMessage = messages[0] // Since messages are reversed for display
    if (newestMessage) {
      try {
        await fetchMore({
          variables: {
            conversationId,
            afterId: newestMessage._id
          },
          updateQuery: (prev, { fetchMoreResult }) => {
            if (!fetchMoreResult?.getMessages?.length) {
              return prev
            }

            const newMessages = fetchMoreResult.getMessages
            const updatedMessages = [...newMessages, ...messages]
            setMessages(updatedMessages)

            // Add new messages to highlighting set (preserving existing highlights)
            setNewMessageIds(prev => {
              const updated = new Set(prev)
              for (const m of newMessages) {
                updated.add(String(m._id))
              }
              return updated
            })

            // Scroll to bottom to show new messages - use double rAF to ensure DOM has rendered
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                scrollToBottom()
              })
            })

            // Return the updated query structure
            return {
              ...prev,
              getMessages: updatedMessages
            }
          }
        })
      } catch (error) {
        console.error('Error loading new messages:', error)
      }
    }

    setLoadingNewer(false)

    // If there was a pending load request, execute it now
    if (pendingLoadNewMessages) {
      setPendingLoadNewMessages(false)
      // Use setTimeout to avoid immediate recursion
      setTimeout(() => loadNewMessages(), 100)
    }
  }, [messages, loadingNewer, fetchMore, conversationId, isTempConversation, pendingLoadNewMessages])

  // Expose loadNewMessages function to parent
  useEffect(() => {
    if (onLoadNewMessages) {
      onLoadNewMessages(loadNewMessages)
    }
  }, [onLoadNewMessages, loadNewMessages])

  // Subscribe to message notifications for this conversation
  useEffect(() => {
    if (isTempConversation) return

    const unsubscribe = subscribeToNotifications((notificationEvent: any) => {
      if (notificationEvent?.type === NotificationType.MessageReceived) {
        // Check if the notification is for this conversation
        if (notificationEvent.conversationId === conversationId) {
          console.log('Received message notification for current conversation:', conversationId)
          // Don't load if we sent the message (it's already added optimistically)
          if (notificationEvent.peerUserId !== currentUser?._id) {
            loadNewMessages()
          }
        }
      }
    })

    return unsubscribe
  }, [subscribeToNotifications, conversationId, loadNewMessages, currentUser?._id, isTempConversation])

  const handleSendMessage = async () => {
    if (!messageText.trim() || isSending || !currentUser || !otherUserId) return

    setIsSending(true)
    
    try {
      await addMessage({
        variables: {
          input: {
            targetUserId: otherUserId,
            message: messageText.trim()
          }
        }
      })
    } catch (error) {
      console.error('Error sending message:', error)
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatMessageTime = (timestamp: number) => {
    return formatRelativeTime(timestamp)
  }

  // Clear new message highlights on any click
  const handleClearHighlights = useCallback(() => {
    if (newMessageIds.size > 0) {
      setNewMessageIds(new Set())
    }
  }, [newMessageIds])

  // Only show full-screen loading for initial load, not refetch
  // NetworkStatus.loading (1) = initial load, NetworkStatus.refetch (4) = refetching
  const isInitialLoading = loading && networkStatus === NetworkStatus.loading

  if (isInitialLoading) {
    return (
      <Box className="flex items-center justify-center h-full">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box className="flex items-center justify-center h-full">
        <Typography color="error">
          {t('errorLoadingMessages')}
        </Typography>
      </Box>
    )
  }

  return (
    <Box className="h-full flex flex-col" onClick={handleClearHighlights}>
      {/* Messages container */}
      <Box
        ref={messagesContainerRef}
        className="flex-grow overflow-y-auto px-12sp py-1"
        onScroll={handleScroll}
        sx={{
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '3px',
          },
        }}
      >
        {/* Loading indicator for more messages */}
        {loadingMore && (
          <Box className="flex justify-center py-2">
            <CircularProgress size={20} />
          </Box>
        )}
        
        {/* Messages list (reversed to show newest first) */}
        {[...messages].reverse().map((message) => {
          const isOwnMessage = message.userId === currentUser?._id
          const isNewMessage = newMessageIds.has(message._id)

          return (
            <Box
              key={message._id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-12sp`}
            >
              <div
                className={`
                  max-w-[70%] p-3 relative card-bg
                  ${isOwnMessage ? 'speech-bubble-right' : 'speech-bubble-left'}
                  rounded-xl
                  ${isNewMessage ? 'new-message-highlight' : ''}
                `}
              >
                <Typography variant="body2" component="div" className="whitespace-pre-wrap break-words">
                  {formatTextWithLinks(message.message)}
                </Typography>
                <Typography
                  variant="caption"
                  className="block mt-1 text-xs select-none dimmest-text-color"
                >
                  {formatMessageTime(message.createdAt)}
                  {message.edited && ` • ${t('edited')}`}
                </Typography>
              </div>
            </Box>
          )
        })}
        
        {messages.length === 0 && !isTempConversation && loading && (
          <Box className="flex items-center justify-center h-full">
            <CircularProgress />
          </Box>
        )}

        {messages.length === 0 && !isTempConversation && !loading && (
          <Box className="flex items-center justify-center h-full">
            <Typography className="text-gray-500 text-center">
              {t('noMessagesYet')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Input area */}
      <Paper className="border-t brighter-border" elevation={0} sx={{ backgroundColor: 'var(--brighter-color)', 'padding': 'var(--10sp)' }}>
        <Box className="flex gap-2 items-end">
          <Box className="flex-grow">
            <div
              ref={messageInputRef}
              contentEditable
              className="input-bg brighter-border normal-bg min-h-[2.5rem] max-h-[6rem] overflow-y-auto p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{
                lineHeight: '1.5',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
              onInput={(e) => {
                const target = e.target as HTMLDivElement
                setMessageText(target.textContent || '')
              }}
              onKeyDown={handleKeyPress}
              data-placeholder={t('typeMessage')}
              suppressContentEditableWarning={true}
            />
          </Box>
          <IconButton
            onClick={handleSendMessage}
            disabled={!messageText.trim() || isSending}
            className={`${isSending ? '' : 'icon-gradient'} ${
              !messageText.trim() && !isSending ? 'opacity-50' : ''
            }`}
          >
            {isSending ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Box>
      </Paper>
    </Box>
  )
} 