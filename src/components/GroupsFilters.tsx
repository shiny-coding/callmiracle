'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button, FormControlLabel, Checkbox, TextField, FormGroup, Typography, IconButton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

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
  const [activeFiltersSummary, setActiveFiltersSummary] = useState('')

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

  // Update active filters summary
  useEffect(() => {
    const summaryParts: string[] = []

    // Name filter
    if (appliedNameFilter) {
      summaryParts.push(`"${appliedNameFilter}"`)
    }

    // Group type filters
    if (!appliedShowOpenGroups && appliedShowPrivateGroups) {
      summaryParts.push(t('privateGroups'))
    } else if (appliedShowOpenGroups && !appliedShowPrivateGroups) {
      summaryParts.push(t('openGroups'))
    }

    // My groups filter
    if (appliedShowMyGroups) {
      summaryParts.push(t('myGroups'))
    }

    setActiveFiltersSummary(summaryParts.join(', '))
  }, [
    appliedNameFilter,
    appliedShowOpenGroups,
    appliedShowPrivateGroups,
    appliedShowMyGroups,
    t
  ])

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

  return (
    <>
      <div className={`flex flex-col overflow-hidden ${isExpanded ? 'flex-grow' : ''}`}>
        <div className="flex items-center py-2" style={{ userSelect: 'none' }}>
          <IconButton size="small" onClick={handleToggleExpand} aria-label={isExpanded ? t('collapseFilters') : t('expandFilters')}>
            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
          <Typography variant="subtitle1" component="span" onClick={handleToggleExpand} className="cursor-pointer">
            {t('filterGroups')}
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={changedShowMyGroups}
                      onChange={e => setChangedShowMyGroups(e.target.checked)}
                    />
                  }
                  label={t('myGroups')}
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