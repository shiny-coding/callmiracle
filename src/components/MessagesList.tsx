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

const GET_MESSAGES = gql`
  query GetMessages($conversationId: ID!, $beforeId: ID) {
    getMessages(conversationId: $conversationId, beforeId: $beforeId) {
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
}

export default function MessagesList({ conversationId, onMessageSent }: MessagesListProps) {
  const t = useTranslations()
  const currentUser = useStore(state => state.currentUser)
  const { conversations } = useConversations()
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  
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
        setHasMore(data.getMessages.length === 50) // Assuming MESSAGES_PER_PAGE = 50
        
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

    const { scrollTop } = messagesContainerRef.current
    
    // Load more messages when scrolled near the top
    if (scrollTop < 100) {
      setLoadingMore(true)
      
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
              setHasMore(newMessages.length === 50)
              
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
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <Paper
                className={`max-w-[70%] p-3 ${
                  isOwnMessage 
                    ? 'bg-blue-500 text-white dark' 
                    : 'bg-gray-100 text-gray-900'
                }`}
                elevation={1}
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
              </Paper>
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
      <Paper className="border-t border-gray-200 p-4" elevation={0}>
        <Box className="flex gap-2 items-end">
          <Box className="flex-grow">
            <div
              ref={messageInputRef}
              contentEditable
              className="min-h-[2.5rem] max-h-[6rem] overflow-y-auto p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{
                borderColor: 'var(--border-color)',
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