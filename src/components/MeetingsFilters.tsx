'use client'

import { Button, Checkbox, FormControlLabel, FormGroup, Slider, Typography, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import { useStore } from '@/store/useStore'
import InterestSelector from './InterestSelector'
import LanguageSelector from './LanguageSelector'
import GroupSelector from './GroupSelector'
import { useEffect, useState, useRef } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useGroups } from '@/store/GroupsProvider'

interface MeetingsFiltersProps {
  onToggleFilters: (visible: boolean) => void // Callback to inform parent about changes
}

export default function MeetingsFilters({ onToggleFilters }: MeetingsFiltersProps) {
  const t = useTranslations()
  const { groups } = useGroups()

  // Applied filters from the store
  const {
    currentUser,
    filterInterests,
    filterLanguages,
    filterAllowedMales,
    filterAllowedFemales,
    filterAgeRange,
    filterMinDurationM,
    filterGroups,
    setFilterInterests,
    setFilterLanguages,
    setFilterAllowedMales,
    setFilterAllowedFemales,
    setFilterAgeRange,
    setFilterMinDurationM,
    setFilterGroups,
  } = useStore(state => ({
    currentUser: state.currentUser,
    filterInterests: state.filterInterests,
    filterLanguages: state.filterLanguages,
    filterAllowedMales: state.filterAllowedMales,
    filterAllowedFemales: state.filterAllowedFemales,
    filterAgeRange: state.filterAgeRange,
    filterMinDurationM: state.filterMinDurationM,
    filterGroups: state.filterGroups,
    setFilterInterests: state.setFilterInterests,
    setFilterLanguages: state.setFilterLanguages,
    setFilterAllowedMales: state.setFilterAllowedMales,
    setFilterAllowedFemales: state.setFilterAllowedFemales,
    setFilterAgeRange: state.setFilterAgeRange,
    setFilterMinDurationM: state.setFilterMinDurationM,
    setFilterGroups: state.setFilterGroups,
  }))

  // Local interactive state for filters
  const [changedFilterInterests, setChangedFilterInterests] = useState<string[]>(filterInterests)
  const [changedFilterLanguages, setChangedFilterLanguages] = useState<string[]>(filterLanguages)
  const [changedFilterAllowedMales, setChangedFilterAllowedMales] = useState<boolean>(filterAllowedMales)
  const [changedFilterAllowedFemales, setChangedFilterAllowedFemales] = useState<boolean>(filterAllowedFemales)
  const [changedFilterAgeRange, setChangedFilterAgeRange] = useState<[number, number]>(filterAgeRange)
  const [changedFilterMinDurationM, setChangedFilterMinDurationM] = useState<number>(filterMinDurationM)
  const [changedFilterGroups, setChangedFilterGroups] = useState<string[]>(filterGroups)

  const [hasChanges, setHasChanges] = useState<boolean>(false)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [activeFiltersSummary, setActiveFiltersSummary] = useState<string>('')

  const scrollableContainerRef = useRef<HTMLDivElement>(null)

  // Get available groups accessible to current user
  const availableGroups = groups?.filter(group => 
    currentUser?.groups?.includes(group._id)
  ) || []

  // Determine which groups to use for interest pairs
  const selectedGroups = changedFilterGroups.length > 0 
    ? groups?.filter(group => changedFilterGroups.includes(group._id)) || []
    : availableGroups

  // Sync local state when store's applied filters change (e.g., on init or external update)
  useEffect(() => {
    setChangedFilterInterests([...filterInterests])
    setChangedFilterLanguages([...filterLanguages])
    setChangedFilterAllowedMales(filterAllowedMales)
    setChangedFilterAllowedFemales(filterAllowedFemales)
    setChangedFilterAgeRange([...filterAgeRange] as [number, number])
    setChangedFilterMinDurationM(filterMinDurationM)
    setChangedFilterGroups([...filterGroups])
  }, [
    filterInterests, 
    filterLanguages, 
    filterAllowedMales, 
    filterAllowedFemales, 
    filterAgeRange, 
    filterMinDurationM,
    filterGroups
  ])

  // Check for changes between local interactive state and store's applied state
  useEffect(() => {
    const changed =
      changedFilterInterests.join(',') !== filterInterests.join(',') ||
      changedFilterLanguages.join(',') !== filterLanguages.join(',') ||
      changedFilterAllowedMales !== filterAllowedMales ||
      changedFilterAllowedFemales !== filterAllowedFemales ||
      changedFilterAgeRange.join(',') !== filterAgeRange.join(',') ||
      changedFilterMinDurationM !== filterMinDurationM ||
      changedFilterGroups.join(',') !== filterGroups.join(',')

    setHasChanges(changed)
  }, [
    changedFilterInterests, changedFilterLanguages, changedFilterAllowedMales, changedFilterAllowedFemales, changedFilterAgeRange, changedFilterMinDurationM, changedFilterGroups,
    filterInterests, filterLanguages, filterAllowedMales, filterAllowedFemales, filterAgeRange, filterMinDurationM, filterGroups
  ])

  useEffect(() => {
    const summaryParts: string[] = []

    // Groups
    if (changedFilterGroups.length > 0 && changedFilterGroups.length < availableGroups.length) {
      const groupNames = changedFilterGroups.map(groupId => 
        groups?.find(g => g._id === groupId)?.name || groupId
      ).join(', ')
      summaryParts.push(groupNames)
    }

    // Minimum Duration
    if (changedFilterMinDurationM === 60) {
      summaryParts.push('60min')
    }

    // Languages
    const userLanguages = currentUser?.languages || []
    if (userLanguages.length > 1) {
      if (changedFilterLanguages.length > 0 && changedFilterLanguages.length < userLanguages.length) {
        summaryParts.push(changedFilterLanguages.join(', '))
      }
    }

    // Interests
    if (changedFilterInterests.length > 0) {
      summaryParts.push(changedFilterInterests.join(', '))
    }

    // Age Range
    if (changedFilterAgeRange[0] !== 10 || changedFilterAgeRange[1] !== 100) {
      summaryParts.push(`${changedFilterAgeRange[0]}-${changedFilterAgeRange[1]}`)
    }

    // Allowed Genders
    if (!changedFilterAllowedMales && changedFilterAllowedFemales) { // Only females allowed
      summaryParts.push(t('females'))
    } else if (changedFilterAllowedMales && !changedFilterAllowedFemales) { // Only males allowed
      summaryParts.push(t('males'))
    }

    setActiveFiltersSummary(summaryParts.join(', '))
  }, [
    changedFilterGroups,
    changedFilterMinDurationM,
    changedFilterLanguages,
    changedFilterInterests,
    changedFilterAgeRange,
    changedFilterAllowedMales,
    changedFilterAllowedFemales,
    availableGroups,
    groups,
    currentUser?.languages,
    t
  ])

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
    onToggleFilters(!isExpanded)
  }

  const handleChangedFilterMalesChange = (checked: boolean) => {
    if (!checked && !changedFilterAllowedFemales) {
      setChangedFilterAllowedFemales(true) // Ensure at least one gender is allowed
    }
    setChangedFilterAllowedMales(checked)
  }

  const handleChangedFilterFemalesChange = (checked: boolean) => {
    if (!checked && !changedFilterAllowedMales) {
      setChangedFilterAllowedMales(true) // Ensure at least one gender is allowed
    }
    setChangedFilterAllowedFemales(checked)
  }

  const handleApplyClick = () => {
    // Apply local changes to the store
    setFilterInterests([...changedFilterInterests])
    setFilterLanguages([...changedFilterLanguages])
    setFilterAllowedMales(changedFilterAllowedMales)
    setFilterAllowedFemales(changedFilterAllowedFemales)
    setFilterAgeRange([...changedFilterAgeRange] as [number, number])
    setFilterMinDurationM(changedFilterMinDurationM)
    setFilterGroups([...changedFilterGroups])
    
    setHasChanges(false) // Reset after applying
    setIsExpanded(false) // Collapse the filter section
    onToggleFilters(false) // Inform parent about visibility change
  }

  const handleCancelClick = () => {
    // Reset local state from store
    setChangedFilterInterests([...filterInterests])
    setChangedFilterLanguages([...filterLanguages])
    setChangedFilterAllowedMales(filterAllowedMales)
    setChangedFilterAllowedFemales(filterAllowedFemales)
    setChangedFilterAgeRange([...filterAgeRange] as [number, number])
    setChangedFilterMinDurationM(filterMinDurationM)
    setChangedFilterGroups([...filterGroups])
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
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center py-2" style={{ userSelect: 'none' }}>
          <IconButton size="small" onClick={handleToggleExpand} aria-label={isExpanded ? t('collapseFilters') : t('expandFilters')}>
            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
          <Typography variant="subtitle1" component="span" onClick={handleToggleExpand} className="cursor-pointer">
            {t('filterMeetings')}
          </Typography>
          {!isExpanded && activeFiltersSummary && (
            <Typography variant="caption" component="span" sx={{ ml: 1, color: 'text.secondary', flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'wrap' }}>
              ({activeFiltersSummary})
            </Typography>
          )}
        </div>

        {isExpanded && (
          <div 
            ref={scrollableContainerRef} 
            className="flex-grow overflow-y-auto flex flex-col gap-4 px-32sp py-0 pb-4"
          >
            <GroupSelector
              value={changedFilterGroups}
              onChange={setChangedFilterGroups}
              label={t('filterByGroups')}
              availableGroups={availableGroups}
            />
            {selectedGroups.map(group => (
              <InterestSelector
                key={group._id}
                value={changedFilterInterests}
                onChange={setChangedFilterInterests}
                label={`${t('filterByInterests')} - ${group.name}`}
                interestsPairs={group.interestsPairs || []}
              />
            ))}
            <LanguageSelector
              value={changedFilterLanguages}
              onChange={setChangedFilterLanguages}
              label={t('filterByLanguage')}
              availableLanguages={currentUser?.languages || []}
            />
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={changedFilterAllowedMales}
                    onChange={e => handleChangedFilterMalesChange(e.target.checked)}
                  />
                }
                label={t('allowMales')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={changedFilterAllowedFemales}
                    onChange={e => handleChangedFilterFemalesChange(e.target.checked)}
                  />
                }
                label={t('allowFemales')}
              />
            </FormGroup>
            <div>
              <Typography>
                {t('ageRange')}: {changedFilterAgeRange[0]} - {changedFilterAgeRange[1]}
              </Typography>
              <div className="w-full px-4">
                <Slider
                  value={changedFilterAgeRange}
                  onChange={(_, newValue) => setChangedFilterAgeRange(newValue as [number, number])}
                  min={10}
                  max={100}
                  valueLabelDisplay="auto"
                  sx={{ touchAction: 'pan-y', width: '100%', maxWidth: '100%' }}
                />
              </div>
            </div>
            <div>
              <Typography variant="subtitle1" sx={{ marginBottom: '0.5rem' }}>
                {t('minDuration')}
              </Typography>
              <div className="flex gap-4 justify-start">
                <Button
                  variant={changedFilterMinDurationM === 30 ? 'contained' : 'outlined'}
                  onClick={() => setChangedFilterMinDurationM(30)}
                  className="flex-0 basis-1/2"
                >
                  30 {t('minutes')}
                </Button>
                <Button
                  variant={changedFilterMinDurationM === 60 ? 'contained' : 'outlined'}
                  onClick={() => setChangedFilterMinDurationM(60)}
                  className="flex-0 basis-1/2"
                >
                  1 {t('hour')}
                </Button>
              </div>
            </div>
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