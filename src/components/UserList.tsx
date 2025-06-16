'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, IconButton, FormControlLabel, Checkbox, TextField, FormGroup, Divider } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import { User } from '@/generated/graphql'
import { useUsers } from '@/store/UsersProvider'
import { useGroups } from '@/store/GroupsProvider'
import UserCard from './UserCard'
import { normalizeText } from '@/utils/textNormalization'
import { useStore } from '@/store/useStore'
import LanguageSelector from './LanguageSelector'
import GroupSelector from './GroupSelector'
import LoadingDialog from './LoadingDialog'
import { useRouter, useSearchParams } from 'next/navigation'
import PageHeader from './PageHeader'

export default function UserList() {
  const { users, loading, error, refetch } = useUsers()
  const { groups } = useGroups()
  const t = useTranslations()
  const currentUser = useStore(state => state.currentUser)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showOnlyFriends, setShowOnlyFriends] = useState(false)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [showMales, setShowMales] = useState(true)
  const [showFemales, setShowFemales] = useState(true)

  // Check for groupId parameter and auto-select the group, then remove from URL
  useEffect(() => {
    const groupId = searchParams.get('groupId')
    if (groupId && groups) {
      // Check if the groupId exists in available groups
      const groupExists = groups.some(group => group._id === groupId)
      if (groupExists && !selectedGroups.includes(groupId)) {
        setSelectedGroups([groupId])
      }
      
      // Remove groupId from URL immediately after using it
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('groupId')
      const newUrl = newSearchParams.toString()
      router.replace(`/users${newUrl ? `?${newUrl}` : ''}`, { scroll: false })
    }
  }, [searchParams, groups, router])

  // Collect all available languages from users
  let availableLanguages: string[] = []
  if (users) {
    availableLanguages = Array.from(
      new Set(users.flatMap(user => user.languages))
    )
  }

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  let filteredUsers = users || []
  // Note: We no longer filter out the current user - they will be shown with "Me" label

  // Apply sex filter
  if (!showMales || !showFemales) {
    filteredUsers = filteredUsers.filter(user => {
      if (!user.sex) return showMales && showFemales
      return (showMales && user.sex === 'male') || (showFemales && user.sex === 'female')
    })
  }

  // Apply group filter if any groups are selected
  if (selectedGroups.length > 0) {
    filteredUsers = filteredUsers.filter(user => {
      // Check if user belongs to any of the selected groups
      if (!user.groups || user.groups.length === 0) return false
      return user.groups.some(groupId => selectedGroups.includes(groupId))
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
    <Paper className="h-full flex flex-col">
      <PageHeader
        icon={<PeopleIcon />}
        title={t('users')}
      >
        <IconButton 
          onClick={() => router.back()} 
          aria-label={t('close')}
          title={t('close')}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </PageHeader>

      <div className="flex-grow overflow-y-auto px-4">
        <div className="user-filters my-4">
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
          <GroupSelector
            value={selectedGroups}
            onChange={setSelectedGroups}
            label={t('filterByGroups')}
            availableGroups={groups || []}
          />
        </div>
        <Divider className="mb-4" />
        <div className="relative">
          <List>
            {filteredUsers.map((user: User) => (
              <ListItem 
                key={user._id} 
                className="flex flex-col items-start hover:bg-gray-700 rounded-lg mb-4"
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