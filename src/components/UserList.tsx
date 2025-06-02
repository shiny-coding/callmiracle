'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, IconButton, FormControlLabel, Checkbox, TextField, FormGroup, Divider } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import { User } from '@/generated/graphql'
import { useUsers } from '@/store/UsersProvider'
import UserCard from './UserCard'
import { normalizeText } from '@/utils/textNormalization'
import { useStore } from '@/store/useStore'
import LanguageSelector from './LanguageSelector'
import LoadingDialog from './LoadingDialog'
import { useRouter } from 'next/navigation'

export default function UserList() {
  const { users, loading, error, refetch } = useUsers()
  const t = useTranslations()
  const currentUser = useStore(state => state.currentUser)
  const router = useRouter()
  const [showOnlyFriends, setShowOnlyFriends] = useState(false)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [showMales, setShowMales] = useState(true)
  const [showFemales, setShowFemales] = useState(true)

  // Collect all available languages from users
  let availableLanguages: string[] = []
  if (users) {
    availableLanguages = Array.from(
      new Set(users.flatMap(user => user.languages))
    )
  }

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  let filteredUsers = users || []
  filteredUsers = filteredUsers.filter(user => user._id !== currentUser?._id)

  // Apply sex filter
  if (!showMales || !showFemales) {
    filteredUsers = filteredUsers.filter(user => {
      if (!user.sex) return showMales && showFemales
      return (showMales && user.sex === 'male') || (showFemales && user.sex === 'female')
    })
  }

  // Apply language filter if any languages are selected
  if (selectedLanguages.length > 0) {
    filteredUsers = filteredUsers.filter(user =>
      user.languages.some(lang => selectedLanguages.includes(lang))
    )
  }

  // Apply name filter if provided
  if (nameFilter) {
    const normalizedFilter = normalizeText(nameFilter)
    filteredUsers = filteredUsers.filter(user =>
      normalizeText(user.name).includes(normalizedFilter)
    )
  }

  // Apply friends filter if enabled
  const friends = currentUser?.friends ?? []
  if (showOnlyFriends) {
    filteredUsers = filteredUsers.filter(user =>
      friends.includes(user._id)
    )
  }

  return (
    <Paper className="p-4 h-full flex flex-col">
      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <PeopleIcon sx={{ marginRight: '0.5rem' }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>{t('users')}</Typography>
        <IconButton 
          onClick={() => router.back()} 
          aria-label={t('close')}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </div>

      <div className="flex-grow overflow-y-auto">
        <div className="user-filters mb-4">
          <TextField
            fullWidth
            placeholder={t('searchByName')}
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            className="mb-4"
            size="small"
          />
          <FormGroup className="mb-4">
            <div className="flex gap-4">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showMales}
                    onChange={e => setShowMales(e.target.checked)}
                    size="small"
                  />
                }
                label={t('Profile.male')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showFemales}
                    onChange={e => setShowFemales(e.target.checked)}
                    size="small"
                  />
                }
                label={t('Profile.female')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showOnlyFriends}
                    onChange={() => setShowOnlyFriends(!showOnlyFriends)}
                    className="text-white"
                  />
                }
                label={<span className="text-white">{t('onlyFriends')}</span>}
              />
            </div>
          </FormGroup>
          <LanguageSelector
            value={selectedLanguages}
            onChange={setSelectedLanguages}
            label={t('filterByLanguages')}
            availableLanguages={availableLanguages}
          />
        </div>
        <Divider className="mb-4" />
        <div className="p-4 relative">
          <List>
            {filteredUsers.map((user: User) => (
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
        </div>
      </div>
    </Paper>
  )
} 