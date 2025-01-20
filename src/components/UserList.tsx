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
  
  const t = useTranslations('Status')
  
  if (loading && !users) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading users</Typography>

  const handleUserClick = async (userId: string) => {
    const targetUser = users?.find((u: { userId: string; name: string }) => u.userId === userId)
    console.log('Selected user:', {
      userId,
      name: targetUser?.name,
      timestamp: new Date().toISOString()
    })

    onUserSelect(userId)
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