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
import { gql, useQuery, useMutation } from '@apollo/client'
import { Message, Conversation } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { useConversations } from '@/store/ConversationsProvider'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { formatTextWithLinks } from '../utils/formatTextWithLinks'
import { MESSAGES_PER_PAGE } from '@/config/constants'

const GET_MESSAGES = gql`
  query GetMessages($conversationId: ID!, $beforeId: ID, $afterId: ID) {
    getMessages(conversationId: $conversationId, beforeId: $beforeId, afterId: $afterId) {
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
      edited
    }
  }
`

interface MessagesListProps {
  conversationId: string;
  onMessageSent?: () => void;
  onLoadNewMessages?: (loadNewMessages: () => Promise<void>) => void;
}

export default function MessagesList({ conversationId, onMessageSent, onLoadNewMessages }: MessagesListProps) {
  const t = useTranslations()
  const currentUser = useStore(state => state.currentUser)
  const { conversations } = useConversations()
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [loadingNewer, setLoadingNewer] = useState(false)
  
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLDivElement>(null)
  const isFirstLoad = useRef(true)

  const isTempConversation = conversationId.startsWith('temp_');

  let otherUserId: string | null = null;
  if (isTempConversation) {
    otherUserId = conversationId.replace('temp_', '');
  } else {
    const currentConversation = conversations?.find(conv => conv._id === conversationId);
    otherUserId = currentConversation
        ? (currentConversation.user1Id === currentUser?._id
            ? currentConversation.user2Id
            : currentConversation.user1Id)
        : null;
  }
  
  // Query for initial messages
  const { data, loading, error, fetchMore } = useQuery(GET_MESSAGES, {
    variables: { conversationId },
    skip: isTempConversation,
    onCompleted: (data) => {
      if (data?.getMessages) {
        setMessages(data.getMessages)
        setHasMore(data.getMessages.length === MESSAGES_PER_PAGE)
        
        // Scroll to bottom on initial load
        if (isFirstLoad.current) {
          setTimeout(() => {
            scrollToBottom()
            isFirstLoad.current = false
          }, 100)
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
          setTimeout(scrollToBottom, 100)
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
    isFirstLoad.current = true
    setHasMore(!isTempConversation)
  }, [conversationId, isTempConversation])

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

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
              setMessages(prevMessages => [...prevMessages, ...newMessages])
              setHasMore(newMessages.length === MESSAGES_PER_PAGE)
              
              // Restore scroll position after new messages are added
              setTimeout(() => {
                if (container) {
                  const newScrollHeight = container.scrollHeight
                  const scrollDifference = newScrollHeight - previousScrollHeight
                  container.scrollTop = scrollTop + scrollDifference
                }
              }, 50)
              
              return prev // We handle the state update manually
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
    if (!messages.length || loadingNewer || isTempConversation) return

    setLoadingNewer(true)
    
    const newestMessage = messages[0] // Since messages are reversed for display
    if (newestMessage) {
      try {
        const result = await fetchMore({
          variables: {
            conversationId,
            afterId: newestMessage._id
          },
          updateQuery: (prev, { fetchMoreResult }) => {
            if (!fetchMoreResult?.getMessages?.length) {
              return prev
            }
            
            const newMessages = fetchMoreResult.getMessages
            setMessages(prevMessages => [...newMessages, ...prevMessages])
            
            // Scroll to bottom to show new messages
            setTimeout(scrollToBottom, 100)
            
            return prev // We handle the state update manually
          }
        })
      } catch (error) {
        console.error('Error loading new messages:', error)
      }
    }
    
    setLoadingNewer(false)
  }, [messages, loadingNewer, fetchMore, conversationId, isTempConversation])

  // Expose loadNewMessages function to parent
  useEffect(() => {
    if (onLoadNewMessages) {
      onLoadNewMessages(loadNewMessages)
    }
  }, [onLoadNewMessages, loadNewMessages])

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

  if (loading) {
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
    <Box className="h-full flex flex-col">
      {/* Messages container */}
      <Box 
        ref={messagesContainerRef}
        className="flex-grow overflow-y-auto p-4 space-y-3"
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
          
          return (
            <Box
              key={message._id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2`}
            >
              <div
                className={`
                  max-w-[70%] p-3 relative brighter-bg
                  ${isOwnMessage ? 'speech-bubble-right' : 'speech-bubble-left'
                  }
                  rounded-xl shadow-lg
                `}
              >
                <Typography variant="body2" component="div" className="whitespace-pre-wrap break-words">
                  {formatTextWithLinks(message.message)}
                </Typography>
                <Typography 
                  variant="caption" 
                  className={`block mt-1 text-xs ${
                    isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {formatMessageTime(message.createdAt)}
                  {message.edited && ` • ${t('edited')}`}
                </Typography>
              </div>
            </Box>
          )
        })}
        
        {messages.length === 0 && !isTempConversation && (
          <Box className="flex items-center justify-center h-full">
            <Typography className="text-gray-500 text-center">
              {t('noMessagesYet')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Input area */}
      <Paper className="border-t brighter-border p-4" elevation={0} sx={{ backgroundColor: 'var(--brighter-color)' }}>
        <Box className="flex gap-2 items-end">
          <Box className="flex-grow">
            <div
              ref={messageInputRef}
              contentEditable
              className="brighter-border normal-bg min-h-[2.5rem] max-h-[6rem] overflow-y-auto p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{
                lineHeight: '1.5',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap'
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
            className={`${
              messageText.trim() && !isSending
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-300 text-gray-500'
            }`}
          >
            {isSending ? <CircularProgress size={20} /> : <SendIcon />}
          </IconButton>
        </Box>
      </Paper>
    </Box>
  )
} 