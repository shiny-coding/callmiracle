'use client'

import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, IconButton } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { User } from '@/generated/graphql'
import { useUsers } from '@/store/UsersProvider'
import UserCard from './UserCard'
import { normalizeText } from '@/utils/textNormalization'
import { useStore } from '@/store/useStore'

interface UserListProps {
  filterLanguages?: string[]
  nameFilter?: string
  showMales?: boolean
  showFemales?: boolean
}

export default function UserList({ 
  filterLanguages = [], 
  nameFilter = '',
  showMales = true,
  showFemales = true 
}: UserListProps) {
  const { users, loading, error, refetch } = useUsers()
  const t = useTranslations()
  const currentUser = useStore(state => state.currentUser)

  if (loading && !users) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading users</Typography>

  let filteredUsers = users || []
  filteredUsers = filteredUsers.filter(user => user._id !== currentUser?._id)

  // Apply sex filter
  if (!showMales || !showFemales) {
    filteredUsers = filteredUsers.filter(user => {
      if (!user.sex) return showMales && showFemales // Include users without sex set only if both are selected
      return (showMales && user.sex === 'male') || (showFemales && user.sex === 'female')
    })
  }

  // Apply language filter if any languages are selected
  if (filterLanguages.length > 0) {
    filteredUsers = filteredUsers.filter(user =>
      user.languages.some(lang => filterLanguages.includes(lang))
    )
  }

  // Apply name filter if provided
  if (nameFilter) {
    const normalizedFilter = normalizeText(nameFilter)
    filteredUsers = filteredUsers.filter(user => 
      normalizeText(user.name).includes(normalizedFilter)
    )
  }

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
        {filteredUsers?.map((user: User) => (
          <ListItem 
            key={user._id} 
            className="flex flex-col items-start hover:bg-gray-700 rounded-lg"
          >
            <div className="w-full">
              <UserCard 
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