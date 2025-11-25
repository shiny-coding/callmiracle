'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button, FormControlLabel, Checkbox, TextField, FormGroup, Typography, IconButton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import LanguageSelector from './LanguageSelector'
import GroupSelector from './GroupSelector'
import { Group } from '@/generated/graphql'
import StandardChip from './StandardChip'
import { LANGUAGES } from '@/config/languages'
import FilterChipsContainer from './FilterChipsContainer'

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
  const locale = useLocale()
  
  // Local interactive state for filters
  const [changedShowOnlyFriends, setChangedShowOnlyFriends] = useState(appliedShowOnlyFriends)
  const [changedSelectedLanguages, setChangedSelectedLanguages] = useState<string[]>(appliedSelectedLanguages)
  const [changedSelectedGroups, setChangedSelectedGroups] = useState<string[]>(appliedSelectedGroups)
  const [changedNameFilter, setChangedNameFilter] = useState(appliedNameFilter)
  const [changedShowMales, setChangedShowMales] = useState(appliedShowMales)
  const [changedShowFemales, setChangedShowFemales] = useState(appliedShowFemales)
  
  const [hasChanges, setHasChanges] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

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

  // Build active filter chips data
  const activeFilterChips = []

  // Name filter
  if (appliedNameFilter) {
    activeFilterChips.push({
      type: 'name',
      label: `"${appliedNameFilter}"`,
      onDelete: () => {
        setChangedNameFilter('')
        onApplyFilters({
          showOnlyFriends: appliedShowOnlyFriends,
          selectedLanguages: appliedSelectedLanguages,
          selectedGroups: appliedSelectedGroups,
          nameFilter: '',
          showMales: appliedShowMales,
          showFemales: appliedShowFemales
        })
      }
    })
  }

  // Gender filters
  if (!appliedShowMales && appliedShowFemales) {
    activeFilterChips.push({
      type: 'gender',
      label: t('femalesOnly'),
      onDelete: () => {
        setChangedShowMales(true)
        onApplyFilters({
          showOnlyFriends: appliedShowOnlyFriends,
          selectedLanguages: appliedSelectedLanguages,
          selectedGroups: appliedSelectedGroups,
          nameFilter: appliedNameFilter,
          showMales: true,
          showFemales: appliedShowFemales
        })
      }
    })
  } else if (appliedShowMales && !appliedShowFemales) {
    activeFilterChips.push({
      type: 'gender',
      label: t('malesOnly'),
      onDelete: () => {
        setChangedShowFemales(true)
        onApplyFilters({
          showOnlyFriends: appliedShowOnlyFriends,
          selectedLanguages: appliedSelectedLanguages,
          selectedGroups: appliedSelectedGroups,
          nameFilter: appliedNameFilter,
          showMales: appliedShowMales,
          showFemales: true
        })
      }
    })
  }

  // Friends filter
  if (appliedShowOnlyFriends) {
    activeFilterChips.push({
      type: 'friends',
      label: t('onlyFriends'),
      onDelete: () => {
        setChangedShowOnlyFriends(false)
        onApplyFilters({
          showOnlyFriends: false,
          selectedLanguages: appliedSelectedLanguages,
          selectedGroups: appliedSelectedGroups,
          nameFilter: appliedNameFilter,
          showMales: appliedShowMales,
          showFemales: appliedShowFemales
        })
      }
    })
  }

  // Languages (only show if there are multiple languages to filter)
  if (availableLanguages.length > 1 && appliedSelectedLanguages.length > 0 && appliedSelectedLanguages.length < availableLanguages.length) {
    const languageNames = appliedSelectedLanguages
      .map(code => LANGUAGES.find(lang => lang.code === code)?.name || code)
      .join(', ')
    activeFilterChips.push({
      type: 'languages',
      label: languageNames,
      onDelete: () => {
        setChangedSelectedLanguages([])
        onApplyFilters({
          showOnlyFriends: appliedShowOnlyFriends,
          selectedLanguages: [],
          selectedGroups: appliedSelectedGroups,
          nameFilter: appliedNameFilter,
          showMales: appliedShowMales,
          showFemales: appliedShowFemales
        })
      }
    })
  }

  // Groups (only show if there are multiple groups to filter)
  if (availableGroups.length > 1 && appliedSelectedGroups.length > 0) {
    const groupNames = appliedSelectedGroups
      .map(groupId => availableGroups.find(g => g._id === groupId)?.name || groupId)
      .join(', ')
    activeFilterChips.push({
      type: 'groups',
      label: groupNames,
      onDelete: () => {
        setChangedSelectedGroups([])
        onApplyFilters({
          showOnlyFriends: appliedShowOnlyFriends,
          selectedLanguages: appliedSelectedLanguages,
          selectedGroups: [],
          nameFilter: appliedNameFilter,
          showMales: appliedShowMales,
          showFemales: appliedShowFemales
        })
      }
    })
  }

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

  // Handle quick friends filter toggle (always visible)
  const handleQuickFriendsToggle = (checked: boolean) => {
    setChangedShowOnlyFriends(checked)
    onApplyFilters({
      showOnlyFriends: checked,
      selectedLanguages: appliedSelectedLanguages,
      selectedGroups: appliedSelectedGroups,
      nameFilter: appliedNameFilter,
      showMales: appliedShowMales,
      showFemales: appliedShowFemales
    })
  }

  return (
    <div className={`flex flex-col overflow-hidden flex-shrink-0 ${isExpanded ? 'flex-grow' : ''}`}>
      <div className="flex items-center py-2 gap-4" style={{ userSelect: 'none' }}>
        <div className="flex items-center">
          <IconButton size="small" onClick={handleToggleExpand} aria-label={isExpanded ? t('collapseFilters') : t('expandFilters')}>
            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
          <Typography variant="subtitle1" component="span" onClick={handleToggleExpand} className="cursor-pointer">
            {t('filterUsers')}
          </Typography>
        </div>
        {/* Quick friends filter - always visible */}
        <FormControlLabel
          control={
            <Checkbox
              checked={appliedShowOnlyFriends}
              onChange={e => handleQuickFriendsToggle(e.target.checked)}
              size="small"
            />
          }
          label={t('onlyFriends')}
          onClick={e => e.stopPropagation()}
        />
      </div>

      {/* Active filter chips - displayed below toggler when collapsed (excluding friends since it has its own checkbox) */}
      {!isExpanded && activeFilterChips.filter(chip => chip.type !== 'friends').length > 0 && (
        <FilterChipsContainer>
          {activeFilterChips.filter(chip => chip.type !== 'friends').map((chip) => (
            <StandardChip
              key={chip.type}
              label={chip.label}
              onDelete={chip.onDelete}
              deleteIcon={<CloseIcon />}
            />
          ))}
        </FilterChipsContainer>
      )}

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
              </div>
            </FormGroup>
            {availableLanguages.length > 1 && (
              <LanguageSelector
                value={changedSelectedLanguages}
                onChange={setChangedSelectedLanguages}
                label={t('filterByLanguages')}
                availableLanguages={availableLanguages}
              />
            )}
            {availableGroups.length > 1 && (
              <GroupSelector
                value={changedSelectedGroups}
                onChange={setChangedSelectedGroups}
                label={t('filterByGroups')}
                availableGroups={availableGroups}
              />
            )}
          </div>
        )}

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
    </div>
  )
} 