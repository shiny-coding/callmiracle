'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, IconButton, Divider } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import { User } from '@/generated/graphql'
import { useUsers } from '@/store/UsersProvider'
import { useGroups } from '@/store/GroupsProvider'
import UserCard from './UserCard'
import { normalizeText } from '@/utils/textNormalization'
import { useStore } from '@/store/useStore'
import UsersFilters from './UsersFilters'
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

  // Applied filter state (what's actually being used for filtering)
  const [appliedShowOnlyFriends, setAppliedShowOnlyFriends] = useState(false)
  const [appliedSelectedLanguages, setAppliedSelectedLanguages] = useState<string[]>([])
  const [appliedSelectedGroups, setAppliedSelectedGroups] = useState<string[]>([])
  const [appliedNameFilter, setAppliedNameFilter] = useState('')
  const [appliedShowMales, setAppliedShowMales] = useState(true)
  const [appliedShowFemales, setAppliedShowFemales] = useState(true)

  const [filtersVisible, setFiltersVisible] = useState(false)

  // Check for groupId parameter and auto-select the group, then remove from URL
  useEffect(() => {
    const groupId = searchParams.get('groupId')
    if (groupId && groups) {
      // Check if the groupId exists in available groups
      const groupExists = groups.some(group => group._id === groupId)
      if (groupExists && !appliedSelectedGroups.includes(groupId)) {
        setAppliedSelectedGroups([groupId])
      }
      
      // Remove groupId from URL immediately after using it
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('groupId')
      const newUrl = newSearchParams.toString()
      router.replace(`/users${newUrl ? `?${newUrl}` : ''}`, { scroll: false })
    }
  }, [searchParams, groups, router, appliedSelectedGroups])

  // Collect all available languages from users
  let availableLanguages: string[] = []
  if (users) {
    availableLanguages = Array.from(
      new Set(users.flatMap(user => user.languages))
    )
  }

  const handleApplyFilters = (filters: {
    showOnlyFriends: boolean
    selectedLanguages: string[]
    selectedGroups: string[]
    nameFilter: string
    showMales: boolean
    showFemales: boolean
  }) => {
    setAppliedShowOnlyFriends(filters.showOnlyFriends)
    setAppliedSelectedLanguages(filters.selectedLanguages)
    setAppliedSelectedGroups(filters.selectedGroups)
    setAppliedNameFilter(filters.nameFilter)
    setAppliedShowMales(filters.showMales)
    setAppliedShowFemales(filters.showFemales)
  }

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  let filteredUsers = users || []
  // Note: We no longer filter out the current user - they will be shown with "Me" label

  // Apply sex filter
  if (!appliedShowMales || !appliedShowFemales) {
    filteredUsers = filteredUsers.filter(user => {
      if (!user.sex) return appliedShowMales && appliedShowFemales
      return (appliedShowMales && user.sex === 'male') || (appliedShowFemales && user.sex === 'female')
    })
  }

  // Apply group filter if any groups are selected
  if (appliedSelectedGroups.length > 0) {
    filteredUsers = filteredUsers.filter(user => {
      // Check if user belongs to any of the selected groups
      if (!user.groups || user.groups.length === 0) return false
      return user.groups.some(groupId => appliedSelectedGroups.includes(groupId))
    })
  }

  // Get the filtering group (for remove functionality) - only if filtering by a single group
  const filteringGroup = appliedSelectedGroups.length === 1 
    ? groups?.find(g => g._id === appliedSelectedGroups[0]) || null 
    : null

  // Apply language filter if any languages are selected
  if (appliedSelectedLanguages.length > 0) {
    filteredUsers = filteredUsers.filter(user =>
      user.languages.some(lang => appliedSelectedLanguages.includes(lang))
    )
  }

  // Apply name filter if provided
  if (appliedNameFilter) {
    const normalizedFilter = normalizeText(appliedNameFilter)
    filteredUsers = filteredUsers.filter(user =>
      normalizeText(user.name).includes(normalizedFilter)
    )
  }

  // Apply friends filter if enabled
  const friends = currentUser?.friends ?? []
  if (appliedShowOnlyFriends) {
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
          onClick={() => refetch && refetch()}
          aria-label={t('refreshMeetings')}
          title={t('refreshMeetings')}
          size="small"
        >
          <RefreshIcon />
        </IconButton>
      </PageHeader>

      <UsersFilters
        appliedShowOnlyFriends={appliedShowOnlyFriends}
        appliedSelectedLanguages={appliedSelectedLanguages}
        appliedSelectedGroups={appliedSelectedGroups}
        appliedNameFilter={appliedNameFilter}
        appliedShowMales={appliedShowMales}
        appliedShowFemales={appliedShowFemales}
        availableLanguages={availableLanguages}
        availableGroups={groups || []}
        onApplyFilters={handleApplyFilters}
        onToggleFilters={setFiltersVisible}
      />

      {/* Conditional User List Display: Only show if filters are not expanded */}
      {!filtersVisible && (
        <div className="flex-grow overflow-y-auto px-4">
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
                      filteringByGroup={filteringGroup}
                    />
                  </div>
                </ListItem>
              ))}
            </List>
          </div>
        </div>
      )}
    </Paper>
  )
} 