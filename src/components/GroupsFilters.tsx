'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button, FormControlLabel, Checkbox, TextField, FormGroup, Typography, IconButton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import StandardChip from './StandardChip'
import FilterChipsContainer from './FilterChipsContainer'

interface GroupsFiltersProps {
  // Applied filters (from parent state)
  appliedShowMyGroups: boolean
  appliedNameFilter: string
  appliedShowOpenGroups: boolean
  appliedShowPrivateGroups: boolean
  
  // Callbacks
  onApplyFilters: (filters: {
    showMyGroups: boolean
    nameFilter: string
    showOpenGroups: boolean
    showPrivateGroups: boolean
  }) => void
  onToggleFilters: (visible: boolean) => void
}

export default function GroupsFilters({
  appliedShowMyGroups,
  appliedNameFilter,
  appliedShowOpenGroups,
  appliedShowPrivateGroups,
  onApplyFilters,
  onToggleFilters
}: GroupsFiltersProps) {
  const t = useTranslations()
  
  // Local interactive state for filters
  const [changedShowMyGroups, setChangedShowMyGroups] = useState(appliedShowMyGroups)
  const [changedNameFilter, setChangedNameFilter] = useState(appliedNameFilter)
  const [changedShowOpenGroups, setChangedShowOpenGroups] = useState(appliedShowOpenGroups)
  const [changedShowPrivateGroups, setChangedShowPrivateGroups] = useState(appliedShowPrivateGroups)
  
  const [hasChanges, setHasChanges] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Sync local state when applied filters change
  useEffect(() => {
    setChangedShowMyGroups(appliedShowMyGroups)
    setChangedNameFilter(appliedNameFilter)
    setChangedShowOpenGroups(appliedShowOpenGroups)
    setChangedShowPrivateGroups(appliedShowPrivateGroups)
  }, [
    appliedShowMyGroups,
    appliedNameFilter,
    appliedShowOpenGroups,
    appliedShowPrivateGroups
  ])

  // Check for changes between local interactive state and applied state
  useEffect(() => {
    const changed =
      changedShowMyGroups !== appliedShowMyGroups ||
      changedNameFilter !== appliedNameFilter ||
      changedShowOpenGroups !== appliedShowOpenGroups ||
      changedShowPrivateGroups !== appliedShowPrivateGroups

    setHasChanges(changed)
  }, [
    changedShowMyGroups, changedNameFilter, changedShowOpenGroups, changedShowPrivateGroups,
    appliedShowMyGroups, appliedNameFilter, appliedShowOpenGroups, appliedShowPrivateGroups
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
          showMyGroups: appliedShowMyGroups,
          nameFilter: '',
          showOpenGroups: appliedShowOpenGroups,
          showPrivateGroups: appliedShowPrivateGroups
        })
      }
    })
  }

  // Group type filters
  if (!appliedShowOpenGroups && appliedShowPrivateGroups) {
    activeFilterChips.push({
      type: 'groupType',
      label: t('privateGroups'),
      onDelete: () => {
        setChangedShowOpenGroups(true)
        onApplyFilters({
          showMyGroups: appliedShowMyGroups,
          nameFilter: appliedNameFilter,
          showOpenGroups: true,
          showPrivateGroups: appliedShowPrivateGroups
        })
      }
    })
  } else if (appliedShowOpenGroups && !appliedShowPrivateGroups) {
    activeFilterChips.push({
      type: 'groupType',
      label: t('openGroups'),
      onDelete: () => {
        setChangedShowPrivateGroups(true)
        onApplyFilters({
          showMyGroups: appliedShowMyGroups,
          nameFilter: appliedNameFilter,
          showOpenGroups: appliedShowOpenGroups,
          showPrivateGroups: true
        })
      }
    })
  }

  // My groups filter
  if (appliedShowMyGroups) {
    activeFilterChips.push({
      type: 'myGroups',
      label: t('myGroups'),
      onDelete: () => {
        setChangedShowMyGroups(false)
        onApplyFilters({
          showMyGroups: false,
          nameFilter: appliedNameFilter,
          showOpenGroups: appliedShowOpenGroups,
          showPrivateGroups: appliedShowPrivateGroups
        })
      }
    })
  }

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
    onToggleFilters(!isExpanded)
  }

  const handleChangedShowOpenGroupsChange = (checked: boolean) => {
    if (!checked && !changedShowPrivateGroups) {
      setChangedShowPrivateGroups(true) // Ensure at least one group type is allowed
    }
    setChangedShowOpenGroups(checked)
  }

  const handleChangedShowPrivateGroupsChange = (checked: boolean) => {
    if (!checked && !changedShowOpenGroups) {
      setChangedShowOpenGroups(true) // Ensure at least one group type is allowed
    }
    setChangedShowPrivateGroups(checked)
  }

  const handleApplyClick = () => {
    // Apply local changes
    onApplyFilters({
      showMyGroups: changedShowMyGroups,
      nameFilter: changedNameFilter,
      showOpenGroups: changedShowOpenGroups,
      showPrivateGroups: changedShowPrivateGroups
    })
    
    setHasChanges(false) // Reset after applying
    setIsExpanded(false) // Collapse the filter section
    onToggleFilters(false) // Inform parent about visibility change
  }

  const handleCancelClick = () => {
    // Reset local state from applied state
    setChangedShowMyGroups(appliedShowMyGroups)
    setChangedNameFilter(appliedNameFilter)
    setChangedShowOpenGroups(appliedShowOpenGroups)
    setChangedShowPrivateGroups(appliedShowPrivateGroups)
    setHasChanges(false)
    setIsExpanded(false) // Collapse the filter section
    onToggleFilters(false) // Inform parent about visibility change
  }

  const handleBackClick = () => {
    setIsExpanded(false)
    onToggleFilters(false) // Inform parent about visibility change
  }

  // Handle quick "Only mine" filter toggle (always visible)
  const handleQuickMyGroupsToggle = (checked: boolean) => {
    setChangedShowMyGroups(checked)
    onApplyFilters({
      showMyGroups: checked,
      nameFilter: appliedNameFilter,
      showOpenGroups: appliedShowOpenGroups,
      showPrivateGroups: appliedShowPrivateGroups
    })
  }

  return (
    <>
      <div className={`flex flex-col overflow-hidden flex-shrink-0 ${isExpanded ? 'flex-grow' : ''}`}>
        <div className="flex items-center py-1 gap-4" style={{ userSelect: 'none' }}>
          <div className="flex items-center">
            <IconButton size="small" onClick={handleToggleExpand} aria-label={isExpanded ? t('collapseFilters') : t('expandFilters')}>
              {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
            </IconButton>
            <Typography variant="subtitle1" component="span" onClick={handleToggleExpand} className="cursor-pointer">
              {t('filterGroups')}
            </Typography>
          </div>
          {/* Quick "Only mine" filter - always visible */}
          <FormControlLabel
            control={
              <Checkbox
                checked={appliedShowMyGroups}
                onChange={e => handleQuickMyGroupsToggle(e.target.checked)}
                size="small"
              />
            }
            label={t('onlyMine')}
            onClick={e => e.stopPropagation()}
          />
        </div>

        {/* Active filter chips - displayed below toggler when collapsed (excluding myGroups since it has its own checkbox) */}
        {!isExpanded && activeFilterChips.filter(chip => chip.type !== 'myGroups').length > 0 && (
          <FilterChipsContainer>
            {activeFilterChips.filter(chip => chip.type !== 'myGroups').map((chip) => (
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
          <div className="flex-grow overflow-y-auto flex flex-col gap-4 px-12sp py-0 pb-4">
            <TextField
              fullWidth
              placeholder={t('searchGroups')}
              value={changedNameFilter}
              onChange={e => setChangedNameFilter(e.target.value)}
              size="small"
            />
            <FormGroup>
              <div className="flex gap-4">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={changedShowOpenGroups}
                      onChange={e => handleChangedShowOpenGroupsChange(e.target.checked)}
                      size="small"
                    />
                  }
                  label={t('openGroups')}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={changedShowPrivateGroups}
                      onChange={e => handleChangedShowPrivateGroupsChange(e.target.checked)}
                      size="small"
                    />
                  }
                  label={t('privateGroups')}
                />
              </div>
            </FormGroup>
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