'use client'

import { gql, useQuery, useMutation, useSubscription } from '@apollo/client'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, Chip, IconButton } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { LANGUAGES } from '@/config/languages'
import { getUserId } from '@/lib/userId'
import { useRef } from 'react'

const GET_USERS = gql`
  query GetUsers {
    users {
      userId
      name
      statuses
      languages
      timestamp
      locale
    }
  }
`

const USERS_SUBSCRIPTION = gql`
  subscription OnUsersUpdated {
    onUsersUpdated {
      userId
      name
      statuses
      languages
      timestamp
      locale
    }
  }
`

const CONNECT_WITH_USER = gql`
  mutation ConnectWithUser($input: ConnectionParamsInput!) {
    connectWithUser(input: $input) {
      offer
      answer
      targetUserId
      initiatorUserId
    }
  }
`

interface UserListProps {
  onUserSelect: (userId: string) => void
  localStream?: MediaStream
}

export default function UserList({ onUserSelect, localStream }: UserListProps) {
  const { data, loading, error, refetch } = useQuery(GET_USERS)
  const { data: subData } = useSubscription(USERS_SUBSCRIPTION, {
    onData: ({ data }) => {
      console.log('UserList: Subscription data received:', {
        hasData: !!data.data,
        type: 'onUsersUpdated',
        timestamp: new Date().toISOString()
      })
      
      const users = data.data?.onUsersUpdated
      if (users) {
        console.log('UserList: Processing user update:', {
          userCount: users.length,
          timestamp: new Date().toISOString()
        })
      } else {
        console.log('UserList: Invalid or empty users data:', {
          data: data.data,
          timestamp: new Date().toISOString()
        })
      }
    },
    onError: (error) => {
      console.error('UserList: Subscription error:', error)
    }
  })
  
  // Use subscription data if available, otherwise use query data
  const users = subData?.onUsersUpdated || data?.users
  
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const t = useTranslations('Status')
  
  if (loading && !users) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading users</Typography>

  const handleUserClick = async (userId: string) => {
    const targetUser = users?.find((u: { userId: string; name: string }) => u.userId === userId)
    console.log('Creating new offer for user:', {
      userId,
      name: targetUser?.name,
      timestamp: new Date().toISOString()
    })

    onUserSelect(userId)

    if (!localStream) {
      console.log('Skipping WebRTC setup - no local stream available')
      return
    }

    // Clean up any existing peer connection
    if (peerConnectionRef.current) {
      console.log('Cleaning up existing peer connection before creating new one')
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Create a new RTCPeerConnection and generate an offer
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    // Add local stream tracks
    console.log('Adding local stream tracks to offer:', localStream.getTracks().length)
    localStream.getTracks().forEach(track => {
      peerConnectionRef.current?.addTrack(track, localStream)
    })

    try {
      // Create and set local description (offer)
      console.log('Creating WebRTC offer')
      const offer = await peerConnectionRef.current.createOffer()
      await peerConnectionRef.current.setLocalDescription(offer)

      // Send the offer through GraphQL mutation
      console.log('Sending offer to server')
      const result = await connectWithUser({
        variables: {
          input: {
            type: 'offer',
            targetUserId: userId,
            initiatorUserId: getUserId(),
            offer: JSON.stringify(offer)
          }
        }
      })

      // Add more detailed logging for answer handling
      if (result.data?.connectWithUser.answer) {
        console.log('Received answer from server:', {
          hasAnswer: true,
          timestamp: new Date().toISOString()
        });
        const answer = JSON.parse(result.data.connectWithUser.answer);
        console.log('Setting remote description');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process any buffered ICE candidates
        console.log('Processing buffered ICE candidates');
        // ... process buffered candidates
      } else {
        console.warn('No answer received from server - will wait for it via subscription');
      }
    } catch (error) {
      console.error('Error creating connection offer:', error)
      // Only clean up on error
      if (peerConnectionRef.current) {
        console.log('Cleaning up peer connection due to error')
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
    }
  }

  return (
    <Paper className="p-4">
      <div className="flex justify-between items-center mb-4">
        <Typography variant="h6">Online Users</Typography>
        <IconButton 
          onClick={() => refetch()} 
          size="small"
          className="hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <RefreshIcon />
        </IconButton>
      </div>
      <List>
        {users?.map((user: any) => (
          <ListItem 
            key={user.userId} 
            className="flex flex-col items-start cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            onClick={() => handleUserClick(user.userId)}
          >
            <div className="flex flex-col w-full">
              <Typography variant="body1">{user.name}</Typography>
              <Typography variant="caption" className="text-gray-500 dark:text-gray-400">
                ID: {user.userId}
              </Typography>
              <div className="mt-1">
                <div className="flex flex-wrap gap-1 mb-2">
                  {user.languages?.map((lang: string) => (
                    <Chip
                      key={lang}
                      label={LANGUAGES.find(l => l.code === lang)?.name || lang}
                      size="small"
                      variant="outlined"
                      className="mr-1"
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.statuses?.map((status: string) => (
                    <Chip
                      key={status}
                      label={t(status)}
                      size="small"
                      color="primary"
                      variant="outlined"
                      className="mr-1"
                    />
                  ))}
                </div>
              </div>
            </div>
          </ListItem>
        ))}
      </List>
    </Paper>
  )
} 