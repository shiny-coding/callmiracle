'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, IconButton, FormControlLabel, Checkbox, TextField, FormGroup, Divider } from '@mui/material'
import GroupIcon from '@mui/icons-material/Group'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import { Group } from '@/generated/graphql'
import { useGroups } from '@/store/GroupsProvider'
import GroupCard from './GroupCard'
import { normalizeText } from '@/utils/textNormalization'
import { useStore } from '@/store/useStore'
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
  const [showMyGroups, setShowMyGroups] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [showOpenGroups, setShowOpenGroups] = useState(true)
  const [showPrivateGroups, setShowPrivateGroups] = useState(true)

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  let filteredGroups = groups || []

  // Apply open/private filter
  if (!showOpenGroups || !showPrivateGroups) {
    filteredGroups = filteredGroups.filter(group => {
      return (showOpenGroups && group.open) || (showPrivateGroups && !group.open)
    })
  }

  // Apply name filter if provided
  if (nameFilter) {
    const normalizedFilter = normalizeText(nameFilter)
    filteredGroups = filteredGroups.filter(group =>
      normalizeText(group.name).includes(normalizedFilter)
    )
  }

  // Apply my groups filter if enabled
  const userGroups = currentUser?.groups ?? []
  if (showMyGroups) {
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
        <div className="group-filters my-4">
          <TextField
            fullWidth
            placeholder={t('searchGroups')}
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
                    checked={showOpenGroups}
                    onChange={e => setShowOpenGroups(e.target.checked)}
                    size="small"
                  />
                }
                label={t('openGroups')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showPrivateGroups}
                    onChange={e => setShowPrivateGroups(e.target.checked)}
                    size="small"
                  />
                }
                label={t('privateGroups')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showMyGroups}
                    onChange={() => setShowMyGroups(!showMyGroups)}
                    className="text-white"
                  />
                }
                label={<span className="text-white">{t('myGroups')}</span>}
              />
            </div>
          </FormGroup>
        </div>
        <Divider className="mb-4" />
        <div className="py-4 relative">
          {filteredGroups.length === 0 ? (
            <Typography className="text-gray-400 text-center py-8">
              {t('noGroupsFound')}
            </Typography>
          ) : (
            <List>
              {filteredGroups.map((group: Group) => (
                <ListItem 
                  key={group._id} 
                  className="flex flex-col items-start hover:bg-gray-700 rounded-lg"
                >
                  <div className="w-full">
                    <GroupCard group={group} />
                  </div>
                </ListItem>
              ))}
            </List>
          )}
        </div>
      </div>
    </Paper>
  )
} 