'use client'

import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, IconButton } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { User } from '@/generated/graphql'
import { useUsers } from '@/store/UsersProvider'
import UserInfoDisplay from './UserInfoDisplay'

export default function UserList() {
  const { users, loading, error, refetch } = useUsers()
  const t = useTranslations()

  if (loading && !users) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading users</Typography>

  return (
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
            className="flex flex-col items-start hover:bg-gray-700 rounded-lg"
          >
            <div className="w-full">
              <UserInfoDisplay 
                user={user} 
                showDetails={true} 
                showCallButton={true}
                showHistoryButton={true}
              />
            </div>
          </ListItem>
        ))}
      </List>
    </Paper>
  )
} 