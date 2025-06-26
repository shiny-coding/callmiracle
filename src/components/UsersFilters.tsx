'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button, FormControlLabel, Checkbox, TextField, FormGroup, Typography, IconButton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LanguageSelector from './LanguageSelector'
import GroupSelector from './GroupSelector'
import { Group } from '@/generated/graphql'

interface UsersFiltersProps {
  // Applied filters (from parent state)
  appliedShowOnlyFriends: boolean
  appliedSelectedLanguages: string[]
  appliedSelectedGroups: string[]
  appliedNameFilter: string
  appliedShowMales: boolean
  appliedShowFemales: boolean
  
  // Filter options
  availableLanguages: string[]
  availableGroups: Group[]
  
  // Callbacks
  onApplyFilters: (filters: {
    showOnlyFriends: boolean
    selectedLanguages: string[]
    selectedGroups: string[]
    nameFilter: string
    showMales: boolean
    showFemales: boolean
  }) => void
  onToggleFilters: (visible: boolean) => void
}

export default function UsersFilters({
  appliedShowOnlyFriends,
  appliedSelectedLanguages,
  appliedSelectedGroups,
  appliedNameFilter,
  appliedShowMales,
  appliedShowFemales,
  availableLanguages,
  availableGroups,
  onApplyFilters,
  onToggleFilters
}: UsersFiltersProps) {
  const t = useTranslations()
  
  // Local interactive state for filters
  const [changedShowOnlyFriends, setChangedShowOnlyFriends] = useState(appliedShowOnlyFriends)
  const [changedSelectedLanguages, setChangedSelectedLanguages] = useState<string[]>(appliedSelectedLanguages)
  const [changedSelectedGroups, setChangedSelectedGroups] = useState<string[]>(appliedSelectedGroups)
  const [changedNameFilter, setChangedNameFilter] = useState(appliedNameFilter)
  const [changedShowMales, setChangedShowMales] = useState(appliedShowMales)
  const [changedShowFemales, setChangedShowFemales] = useState(appliedShowFemales)
  
  const [hasChanges, setHasChanges] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeFiltersSummary, setActiveFiltersSummary] = useState('')

  // Sync local state when applied filters change
  useEffect(() => {
    setChangedShowOnlyFriends(appliedShowOnlyFriends)
    setChangedSelectedLanguages([...appliedSelectedLanguages])
    setChangedSelectedGroups([...appliedSelectedGroups])
    setChangedNameFilter(appliedNameFilter)
    setChangedShowMales(appliedShowMales)
    setChangedShowFemales(appliedShowFemales)
  }, [
    appliedShowOnlyFriends,
    appliedSelectedLanguages,
    appliedSelectedGroups,
    appliedNameFilter,
    appliedShowMales,
    appliedShowFemales
  ])

  // Check for changes between local interactive state and applied state
  useEffect(() => {
    const changed =
      changedShowOnlyFriends !== appliedShowOnlyFriends ||
      changedSelectedLanguages.join(',') !== appliedSelectedLanguages.join(',') ||
      changedSelectedGroups.join(',') !== appliedSelectedGroups.join(',') ||
      changedNameFilter !== appliedNameFilter ||
      changedShowMales !== appliedShowMales ||
      changedShowFemales !== appliedShowFemales

    setHasChanges(changed)
  }, [
    changedShowOnlyFriends, changedSelectedLanguages, changedSelectedGroups, 
    changedNameFilter, changedShowMales, changedShowFemales,
    appliedShowOnlyFriends, appliedSelectedLanguages, appliedSelectedGroups,
    appliedNameFilter, appliedShowMales, appliedShowFemales
  ])

  // Update active filters summary
  useEffect(() => {
    const summaryParts: string[] = []

    // Name filter
    if (appliedNameFilter) {
      summaryParts.push(`"${appliedNameFilter}"`)
    }

    // Gender filters
    if (!appliedShowMales && appliedShowFemales) {
      summaryParts.push(t('Profile.female'))
    } else if (appliedShowMales && !appliedShowFemales) {
      summaryParts.push(t('Profile.male'))
    }

    // Friends filter
    if (appliedShowOnlyFriends) {
      summaryParts.push(t('onlyFriends'))
    }

    // Languages
    if (appliedSelectedLanguages.length > 0 && appliedSelectedLanguages.length < availableLanguages.length) {
      summaryParts.push(appliedSelectedLanguages.join(', '))
    }

    // Groups
    if (appliedSelectedGroups.length > 0) {
      const groupNames = appliedSelectedGroups
        .map(groupId => availableGroups.find(g => g._id === groupId)?.name)
        .filter(Boolean)
        .join(', ')
      if (groupNames) {
        summaryParts.push(groupNames)
      }
    }

    setActiveFiltersSummary(summaryParts.join(', '))
  }, [
    appliedNameFilter,
    appliedShowMales,
    appliedShowFemales,
    appliedShowOnlyFriends,
    appliedSelectedLanguages,
    appliedSelectedGroups,
    availableLanguages,
    availableGroups,
    t
  ])

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
    onToggleFilters(!isExpanded)
  }

  const handleChangedShowMalesChange = (checked: boolean) => {
    if (!checked && !changedShowFemales) {
      setChangedShowFemales(true) // Ensure at least one gender is allowed
    }
    setChangedShowMales(checked)
  }

  const handleChangedShowFemalesChange = (checked: boolean) => {
    if (!checked && !changedShowMales) {
      setChangedShowMales(true) // Ensure at least one gender is allowed
    }
    setChangedShowFemales(checked)
  }

  const handleApplyClick = () => {
    // Apply local changes
    onApplyFilters({
      showOnlyFriends: changedShowOnlyFriends,
      selectedLanguages: [...changedSelectedLanguages],
      selectedGroups: [...changedSelectedGroups],
      nameFilter: changedNameFilter,
      showMales: changedShowMales,
      showFemales: changedShowFemales
    })
    
    setHasChanges(false) // Reset after applying
    setIsExpanded(false) // Collapse the filter section
    onToggleFilters(false) // Inform parent about visibility change
  }

  const handleCancelClick = () => {
    // Reset local state from applied state
    setChangedShowOnlyFriends(appliedShowOnlyFriends)
    setChangedSelectedLanguages([...appliedSelectedLanguages])
    setChangedSelectedGroups([...appliedSelectedGroups])
    setChangedNameFilter(appliedNameFilter)
    setChangedShowMales(appliedShowMales)
    setChangedShowFemales(appliedShowFemales)
    setHasChanges(false)
    setIsExpanded(false) // Collapse the filter section
    onToggleFilters(false) // Inform parent about visibility change
  }

  const handleBackClick = () => {
    setIsExpanded(false)
    onToggleFilters(false) // Inform parent about visibility change
  }

  return (
    <>
      <div className={`flex flex-col overflow-hidden ${isExpanded ? 'flex-grow' : ''}`}>
        <div className="flex items-center py-2" style={{ userSelect: 'none' }}>
          <IconButton size="small" onClick={handleToggleExpand} aria-label={isExpanded ? t('collapseFilters') : t('expandFilters')}>
            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
          <Typography variant="subtitle1" component="span" onClick={handleToggleExpand} className="cursor-pointer">
            {t('filterUsers')}
          </Typography>
          {!isExpanded && activeFiltersSummary && (
            <Typography variant="caption" component="span" sx={{ ml: 1, color: 'text.secondary', flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'wrap' }}>
              ({activeFiltersSummary})
            </Typography>
          )}
        </div>

        {isExpanded && (
          <div className="flex-grow overflow-y-auto flex flex-col gap-4 px-32sp py-0 pb-4">
            <TextField
              fullWidth
              placeholder={t('searchByName')}
              value={changedNameFilter}
              onChange={e => setChangedNameFilter(e.target.value)}
              size="small"
            />
            <FormGroup>
              <div className="flex gap-4">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={changedShowMales}
                      onChange={e => handleChangedShowMalesChange(e.target.checked)}
                      size="small"
                    />
                  }
                  label={t('Profile.male')}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={changedShowFemales}
                      onChange={e => handleChangedShowFemalesChange(e.target.checked)}
                      size="small"
                    />
                  }
                  label={t('Profile.female')}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={changedShowOnlyFriends}
                      onChange={e => setChangedShowOnlyFriends(e.target.checked)}
                    />
                  }
                  label={t('onlyFriends')}
                />
              </div>
            </FormGroup>
            <LanguageSelector
              value={changedSelectedLanguages}
              onChange={setChangedSelectedLanguages}
              label={t('filterByLanguages')}
              availableLanguages={availableLanguages}
            />
            <GroupSelector
              value={changedSelectedGroups}
              onChange={setChangedSelectedGroups}
              label={t('filterByGroups')}
              availableGroups={availableGroups}
            />
          </div>
        )}
      </div>

      {/* Buttons bar, always shown when filters are expanded */}
      {isExpanded && (
        <div
          className="p-3 normal-bg border-t panel-border flex justify-end gap-2 z-20 shadow-lg rounded-md"
          style={{ backgroundColor: 'var(--mui-palette-background-paper)' }}
        >
          {hasChanges ? (
            <>
              <Button onClick={handleCancelClick} variant="outlined">
                {t('cancelChanges')}
              </Button>
              <Button onClick={handleApplyClick} variant="contained" color="primary">
                {t('applyFilters')}
              </Button>
            </>
          ) : (
            <Button onClick={handleBackClick} variant="outlined">
              {t('back')}
            </Button>
          )}
        </div>
      )}
    </>
  )
} 