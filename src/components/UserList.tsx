'use client'

import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, Chip, IconButton, Avatar } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { LANGUAGES } from '@/config/languages'
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { User } from '@/generated/graphql'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import Image from 'next/image'
import { useUsers } from '@/store/UsersProvider'
import CallerDialog from './CallerDialog'
import { useMutation } from '@apollo/client'
import { CONNECT_WITH_USER } from '@/hooks/webrtc/useWebRTCCommon'
import { getUserId } from '@/lib/userId'

export default function UserList() {
  const { users, loading, error, refetch } = useUsers()
  const t = useTranslations('Status')
  const tRoot = useTranslations()
  const { doCall, connectionStatus } = useWebRTCContext()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const { callId, targetUserId } = useStore()

  if (loading && !users) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading users</Typography>

  const handleUserSelect = async (user: User) => {
    console.log('Selected user:', {
      userId: user.userId,
      name: user.name,
      timestamp: new Date().toISOString()
    })
    setSelectedUser(user)
    await doCall(user.userId)
  }

  const handleCancel = async () => {
    if (targetUserId) {
      await connectWithUser({
        variables: {
          input: {
            type: 'expired',
            targetUserId,
            initiatorUserId: getUserId(),
            callId
          }
        }
      })
    }
    setSelectedUser(null)
  }

  return (
    <>
      <Paper 
        className="p-4 relative bg-gray-800" 
      >
        <div className="flex justify-between items-center mb-4 absolute top-0 right-0">
          <IconButton 
            onClick={() => refetch()} 
            size="small"
            className="hover:bg-gray-700 text-white"
          >
            <RefreshIcon className="text-white" />
          </IconButton>
        </div>
        <List>
          {users?.map((user: User) => (
            <ListItem 
              key={user.userId} 
              className="flex flex-col items-start cursor-pointer hover:bg-gray-700 rounded-lg text-white"
              onClick={() => handleUserSelect(user)}
            >
              <div className="flex w-full gap-4">
                <div className="relative w-12 h-12">
                  <div className="rounded-full pl-1 pt-1 overflow-hidden bg-gray-800  w-full h-full">
                    <Avatar className="w-full h-full bg-gray-700 text-white">{user.name[0]?.toUpperCase()}</Avatar>
                    {user.hasImage && (
                      <div className="absolute inset-0 rounded-full overflow-hidden">
                        <Image
                          src={`/profiles/${user.userId}.jpg?t=${user.timestamp}`}
                          alt={user.name}
                          fill
                          unoptimized
                          className="object-cover opacity-0 transition-opacity duration-200"
                          onLoad={(e) => {
                            const target = e.target as HTMLImageElement
                            target.classList.remove('opacity-0')
                          }}
                          onError={(e) => {
                            e.preventDefault()
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    user.online ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                </div>
                <div className="flex-1">
                  <Typography variant="subtitle1" className="font-medium text-white">
                    {user.name}
                  </Typography>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.statuses.map((status) => (
                      <Chip
                        key={status}
                        label={t(status)}
                        size="small"
                        className="text-xs text-white bg-gray-700"
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.languages.map((lang) => {
                      const language = LANGUAGES.find(l => l.code === lang)
                      return (
                        <Chip
                          key={lang}
                          label={language?.name || lang}
                          size="small"
                          className="text-xs text-white bg-gray-700"
                          sx={{ 
                            color: 'white',
                            '& .MuiChip-label': {
                              color: 'white'
                            }
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </ListItem>
          ))}
        </List>
      </Paper>

      <CallerDialog
        open={!!selectedUser && connectionStatus === 'calling'}
        user={selectedUser}
        onCancel={handleCancel}
      />
    </>
  )
} 