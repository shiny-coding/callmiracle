'use client'

import { gql, useQuery, useMutation, useSubscription } from '@apollo/client'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, Chip, IconButton, Avatar } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { LANGUAGES } from '@/config/languages'
import { getUserId } from '@/lib/userId'
import { useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { User } from '@/generated/graphql'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import Image from 'next/image'

const GET_USERS = gql`
  query GetUsers {
    users {
      userId
      name
      statuses
      languages
      timestamp
      locale
      online
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
      online
    }
  }
`

export default function UserList() {
  const { data, loading, error, refetch } = useQuery(GET_USERS)
  const { data: subData } = useSubscription(USERS_SUBSCRIPTION)
  
  // Use subscription data if available, otherwise use query data
  const users = (subData?.onUsersUpdated || data?.users)?.filter(
    (user: User) => user.userId !== getUserId()
  )
  
  const t = useTranslations('Status')
  const tRoot = useTranslations()
  const { doCall } = useWebRTCContext()

  if (loading && !users) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading users</Typography>

  const handleUserSelect = async (user: User) => {
    console.log('Selected user:', {
      userId: user.userId,
      name: user.name,
      timestamp: new Date().toISOString()
    })
    await doCall(user.userId)
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
        {users?.map((user: User) => (
          <ListItem 
            key={user.userId} 
            className="flex flex-col items-start cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            onClick={() => handleUserSelect(user)}
          >
            <div className="flex w-full gap-4">
              <div className="relative w-12 h-12">
                <div className="rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 w-full h-full">
                  <Avatar className="w-full h-full">{user.name[0]?.toUpperCase()}</Avatar>
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    <Image
                      src={`/profiles/${user.userId}.jpg`}
                      alt={user.name}
                      fill
                      unoptimized
                      className="object-cover opacity-0 transition-opacity duration-200"
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement
                        target.classList.remove('opacity-0')
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  </div>
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  user.online ? 'bg-green-500' : 'bg-red-500'
                }`} />
              </div>
              <div className="flex flex-col flex-grow">
                <div className="flex items-center gap-2">
                  <Typography variant="body1">{user.name}</Typography>
                  <Typography variant="caption" className={user.online ? 'text-green-600' : 'text-red-600'}>
                    {user.online ? tRoot('online') : tRoot('offline')}
                  </Typography>
                </div>
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
            </div>
          </ListItem>
        ))}
      </List>
    </Paper>
  )
} 