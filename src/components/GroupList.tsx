'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, IconButton, Divider } from '@mui/material'
import GroupIcon from '@mui/icons-material/Group'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import { Group } from '@/generated/graphql'
import { useGroups } from '@/store/GroupsProvider'
import GroupCard from './GroupCard'
import { normalizeText } from '@/utils/textNormalization'
import { useStore } from '@/store/useStore'
import GroupsFilters from './GroupsFilters'
import LoadingDialog from './LoadingDialog'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import PageHeader from './PageHeader'

export default function GroupList() {
  const { groups, loading, error, refetch } = useGroups()
  const t = useTranslations()
  const currentUser = useStore(state => state.currentUser)
  const router = useRouter()
  const locale = useLocale()

  // Applied filter state (what's actually being used for filtering)
  const [appliedShowMyGroups, setAppliedShowMyGroups] = useState(false)
  const [appliedNameFilter, setAppliedNameFilter] = useState('')
  const [appliedShowOpenGroups, setAppliedShowOpenGroups] = useState(true)
  const [appliedShowPrivateGroups, setAppliedShowPrivateGroups] = useState(true)

  const [filtersVisible, setFiltersVisible] = useState(false)

  const handleApplyFilters = (filters: {
    showMyGroups: boolean
    nameFilter: string
    showOpenGroups: boolean
    showPrivateGroups: boolean
  }) => {
    setAppliedShowMyGroups(filters.showMyGroups)
    setAppliedNameFilter(filters.nameFilter)
    setAppliedShowOpenGroups(filters.showOpenGroups)
    setAppliedShowPrivateGroups(filters.showPrivateGroups)
  }

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  let filteredGroups = groups || []

  // Apply open/private filter
  if (!appliedShowOpenGroups || !appliedShowPrivateGroups) {
    filteredGroups = filteredGroups.filter(group => {
      return (appliedShowOpenGroups && group.open) || (appliedShowPrivateGroups && !group.open)
    })
  }

  // Apply name filter if provided
  if (appliedNameFilter) {
    const normalizedFilter = normalizeText(appliedNameFilter)
    filteredGroups = filteredGroups.filter(group =>
      normalizeText(group.name).includes(normalizedFilter)
    )
  }

  // Apply my groups filter if enabled
  const userGroups = currentUser?.groups ?? []
  if (appliedShowMyGroups) {
    filteredGroups = filteredGroups.filter(group =>
      userGroups.includes(group._id)
    )
  }

  return (
    <Paper className="h-full flex flex-col">
      <PageHeader
        icon={<GroupIcon />}
        title={t('groups')}
      >
        <IconButton 
          onClick={() => router.push(`/${locale}/groups/create`)} 
          aria-label={t('createGroup')}
          title={t('createGroup')}
          size="small"
        >
          <AddIcon />
        </IconButton>
        <IconButton 
          onClick={() => refetch()} 
          aria-label="refresh"
          title="Refresh"
          size="small"
        >
          <RefreshIcon />
        </IconButton>
      </PageHeader>

      <GroupsFilters
        appliedShowMyGroups={appliedShowMyGroups}
        appliedNameFilter={appliedNameFilter}
        appliedShowOpenGroups={appliedShowOpenGroups}
        appliedShowPrivateGroups={appliedShowPrivateGroups}
        onApplyFilters={handleApplyFilters}
        onToggleFilters={setFiltersVisible}
      />

      {/* Conditional Group List Display: Only show if filters are not expanded */}
      {!filtersVisible && (
        <div className="flex-grow overflow-y-auto px-4">
          <Divider className="mb-4" />
          <div className="py-4 relative">
            {filteredGroups.length === 0 ? (
              <Typography className="text-gray-400 text-center py-8">
                {t('noGroupsFound')}
              </Typography>
            ) : (
              <List className="flex flex-col gap-4">
                {filteredGroups.map((group: Group) => (
                  <ListItem 
                    key={group._id} 
                    className="flex flex-col items-start hover:bg-gray-700 rounded-lg !items-stretch"
                  >
                    <GroupCard group={group} />
                  </ListItem>
                ))}
              </List>
            )}
          </div>
        </div>
      )}
    </Paper>
  )
} 