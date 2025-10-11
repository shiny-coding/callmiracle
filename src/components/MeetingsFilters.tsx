'use client'

import { Button, Checkbox, FormControlLabel, FormGroup, Slider, Typography, IconButton } from '@mui/material'
import { useTranslations, useLocale } from 'next-intl'
import { useStore } from '@/store/useStore'
import InterestSelector from './InterestSelector'
import LanguageSelector from './LanguageSelector'
import GroupSelector from './GroupSelector'
import { useEffect, useState, useRef } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useGroups } from '@/store/GroupsProvider'
import CloseIcon from '@mui/icons-material/Close'
import StandardChip from './StandardChip'
import { LANGUAGES } from '@/config/languages'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'

interface MeetingsFiltersProps {
  onToggleFilters: (visible: boolean) => void // Callback to inform parent about changes
  collapseEmptySlots: boolean
  onToggleCollapse: (collapsed: boolean) => void
}

export default function MeetingsFilters({ onToggleFilters, collapseEmptySlots, onToggleCollapse }: MeetingsFiltersProps) {
  const t = useTranslations()
  const locale = useLocale()
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

  // Build active filter chips data
  const activeFilterChips = []

  // Groups
  if (changedFilterGroups.length > 0 && changedFilterGroups.length < availableGroups.length) {
    const groupNames = changedFilterGroups.map(groupId =>
      groups?.find(g => g._id === groupId)?.name || groupId
    ).join(', ')
    activeFilterChips.push({
      type: 'groups',
      label: groupNames,
      onDelete: () => {
        setChangedFilterGroups([])
        setFilterGroups([])
      }
    })
  }

  // Minimum Duration
  if (changedFilterMinDurationM === 60) {
    activeFilterChips.push({
      type: 'duration',
      label: `60${t('min')}`,
      onDelete: () => {
        setChangedFilterMinDurationM(30)
        setFilterMinDurationM(30)
      }
    })
  }

  // Languages
  const userLanguages = currentUser?.languages || []
  if (userLanguages.length > 1 && changedFilterLanguages.length > 0 && changedFilterLanguages.length < userLanguages.length) {
    const languageNames = changedFilterLanguages
      .map(code => LANGUAGES.find(lang => lang.code === code)?.name || code)
      .join(', ')
    activeFilterChips.push({
      type: 'languages',
      label: languageNames,
      onDelete: () => {
        setChangedFilterLanguages([])
        setFilterLanguages([])
      }
    })
  }

  // Interests
  if (changedFilterInterests.length > 0) {
    activeFilterChips.push({
      type: 'interests',
      label: changedFilterInterests.join(', '),
      onDelete: () => {
        setChangedFilterInterests([])
        setFilterInterests([])
      }
    })
  }

  // Age Range
  if (changedFilterAgeRange[0] !== 10 || changedFilterAgeRange[1] !== 100) {
    activeFilterChips.push({
      type: 'age',
      label: `${t('ageRange')}: ${changedFilterAgeRange[0]}-${changedFilterAgeRange[1]}`,
      onDelete: () => {
        setChangedFilterAgeRange([10, 100])
        setFilterAgeRange([10, 100])
      }
    })
  }

  // Allowed Genders
  if (!changedFilterAllowedMales && changedFilterAllowedFemales) {
    activeFilterChips.push({
      type: 'gender',
      label: t('femalesOnly'),
      onDelete: () => {
        setChangedFilterAllowedMales(true)
        setFilterAllowedMales(true)
      }
    })
  } else if (changedFilterAllowedMales && !changedFilterAllowedFemales) {
    activeFilterChips.push({
      type: 'gender',
      label: t('malesOnly'),
      onDelete: () => {
        setChangedFilterAllowedFemales(true)
        setFilterAllowedFemales(true)
      }
    })
  }

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
        <div className="flex items-center py-2 justify-between" style={{ userSelect: 'none' }}>
          <div className="flex items-center">
            <IconButton size="small" onClick={handleToggleExpand} aria-label={isExpanded ? t('collapseFilters') : t('expandFilters')}>
              {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
            </IconButton>
            <Typography variant="subtitle1" component="span" onClick={handleToggleExpand} className="cursor-pointer">
              {t('filterMeetings')}
            </Typography>
          </div>
          <IconButton
            size="small"
            onClick={() => onToggleCollapse(!collapseEmptySlots)}
            aria-label={collapseEmptySlots ? t('showEmptySlots') : t('hideEmptySlots')}
            title={collapseEmptySlots ? t('showEmptySlots') : t('hideEmptySlots')}
          >
            {collapseEmptySlots ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
          </IconButton>
        </div>

        {/* Active filter chips - displayed below toggler when collapsed */}
        {!isExpanded && activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2 pb-2" style={{ gap: '0.2rem' }}>
            {activeFilterChips.map((chip) => (
              <StandardChip
                key={chip.type}
                label={chip.label}
                onDelete={chip.onDelete}
                deleteIcon={<CloseIcon />}
              />
            ))}
          </div>
        )}

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