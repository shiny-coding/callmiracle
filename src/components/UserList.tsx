'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, Divider } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Check for groupId parameter and auto-select the group, then remove from URL
  useEffect(() => {
    const groupId = searchParams.get('groupId')
    if (groupId && groups && currentUser) {
      // Check if the groupId exists in user's groups or is an open group
      const group = groups.find(g => g._id === groupId)
      const isUserInGroup = currentUser.groups?.includes(groupId)
      const isOpenGroup = group?.open
      if (group && (isUserInGroup || isOpenGroup) && !appliedSelectedGroups.includes(groupId)) {
        setAppliedSelectedGroups([groupId])
      }

      // Remove groupId from URL immediately after using it
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('groupId')
      const newUrl = newSearchParams.toString()
      router.replace(`/users${newUrl ? `?${newUrl}` : ''}`, { scroll: false })
    }
  }, [searchParams, groups, currentUser, router, appliedSelectedGroups])

  // Get only languages that the current user speaks
  const availableLanguages = currentUser?.languages || []

  // Get groups that the current user is a member of OR that are open
  const availableGroups = groups?.filter(group =>
    currentUser?.groups?.includes(group._id) || group.open
  ) || []

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

  // Prepare filtered users with useMemo
  const filteredUsers = useMemo(() => {
    let result = users || []
    // Note: We no longer filter out the current user - they will be shown with "Me" label

    // Apply sex filter
    if (!appliedShowMales || !appliedShowFemales) {
      result = result.filter(user => {
        if (!user.sex) return appliedShowMales && appliedShowFemales
        return (appliedShowMales && user.sex === 'male') || (appliedShowFemales && user.sex === 'female')
      })
    }

    // Apply group filter if any groups are selected
    if (appliedSelectedGroups.length > 0) {
      result = result.filter(user => {
        // Check if user belongs to any of the selected groups
        if (!user.groups || user.groups.length === 0) return false
        return user.groups.some(groupId => appliedSelectedGroups.includes(groupId))
      })
    }

    // Apply language filter if any languages are selected
    if (appliedSelectedLanguages.length > 0) {
      result = result.filter(user =>
        user.languages.some(lang => appliedSelectedLanguages.includes(lang))
      )
    }

    // Apply name filter if provided
    if (appliedNameFilter) {
      const normalizedFilter = normalizeText(appliedNameFilter)
      result = result.filter(user =>
        normalizeText(user.name).includes(normalizedFilter)
      )
    }

    // Apply friends filter if enabled
    const friends = currentUser?.friends ?? []
    if (appliedShowOnlyFriends) {
      result = result.filter(user =>
        friends.includes(user._id)
      )
    }

    return result
  }, [
    users,
    appliedShowMales,
    appliedShowFemales,
    appliedSelectedGroups,
    appliedSelectedLanguages,
    appliedNameFilter,
    appliedShowOnlyFriends,
    currentUser
  ])

  // Get the filtering group (for remove functionality) - only if filtering by a single group
  const filteringGroup = appliedSelectedGroups.length === 1
    ? groups?.find(g => g._id === appliedSelectedGroups[0]) || null
    : null

  // Set up virtualizer - must be called unconditionally
  const virtualizer = useVirtualizer({
    count: filteredUsers.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 180, // Estimated user card height
    overscan: 5, // Render 5 extra items above and below viewport
  })

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  return (
    <Paper className="h-full flex flex-col">
      <PageHeader
        icon={<PeopleIcon className="dimmer-text-color" />}
        title={t('users')}
      />

      <UsersFilters
        appliedShowOnlyFriends={appliedShowOnlyFriends}
        appliedSelectedLanguages={appliedSelectedLanguages}
        appliedSelectedGroups={appliedSelectedGroups}
        appliedNameFilter={appliedNameFilter}
        appliedShowMales={appliedShowMales}
        appliedShowFemales={appliedShowFemales}
        availableLanguages={availableLanguages}
        availableGroups={availableGroups}
        onApplyFilters={handleApplyFilters}
        onToggleFilters={setFiltersVisible}
      />

      {/* Conditional User List Display: Only show if filters are not expanded */}
      {!filtersVisible && (
        <div
          ref={scrollContainerRef}
          className="flex-grow overflow-y-auto px-12sp"
          style={{ position: 'relative', paddingTop: 'var(--list-item-gap)', paddingBottom: 'var(--list-item-gap)' }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const user = filteredUsers[virtualItem.index]

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    display: 'block',
                    paddingBottom: 'var(--list-item-gap)',
                  }}
                >
                  <ListItem
                    key={user._id}
                    className="flex flex-col items-start card-bg rounded-lg"
                  >
                    <div className="w-full">
                      <UserCard
                        user={user}
                        showDetails={true}
                        showCallButton={true}
                        showMessageButton={true}
                        filteringByGroup={filteringGroup}
                      />
                    </div>
                  </ListItem>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Paper>
  )
} 