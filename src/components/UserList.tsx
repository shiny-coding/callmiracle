'use client'

import { gql, useQuery, useMutation } from '@apollo/client'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, Chip, IconButton } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { LANGUAGES } from '@/config/languages'
import { getUserId } from '@/lib/userId'

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
  const { data, loading, error, refetch } = useQuery(GET_USERS, {
    pollInterval: 15000 // Poll every 15 seconds to keep the list updated
  })
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const t = useTranslations('Status')
  
  if (loading) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading users</Typography>

  const handleUserClick = async (userId: string) => {
    onUserSelect(userId)

    // Create a new RTCPeerConnection and generate an offer
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream)
      })
    }

    try {
      // Create and set local description (offer)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Send the offer through GraphQL mutation
      await connectWithUser({
        variables: {
          input: {
            targetUserId: userId,
            initiatorUserId: getUserId(),
            offer: JSON.stringify(offer)
          }
        }
      })
    } catch (error) {
      console.error('Error creating connection offer:', error)
    } finally {
      // Clean up the temporary peer connection
      pc.close()
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
        {data?.users.map((user: any) => (
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