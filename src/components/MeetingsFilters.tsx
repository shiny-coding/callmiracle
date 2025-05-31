'use client'

import { Button, Checkbox, FormControlLabel, FormGroup, Slider, Typography, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Interest } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import InterestSelector from './InterestSelector'
import { interestRelationships } from './InterestSelector'
import LanguageSelector from './LanguageSelector'
import { useEffect, useState, useCallback, useRef } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

interface MeetingsFiltersProps {
  onApplyFilters: () => void // Callback to trigger refetch in context
  onToggleFilters: (visible: boolean) => void // Callback to inform parent about changes
}

export default function MeetingsFilters({ onApplyFilters, onToggleFilters }: MeetingsFiltersProps) {
  const t = useTranslations()

  // Applied filters from the store
  const {
    currentUser,
    filterInterests,
    filterLanguages,
    filterAllowedMales,
    filterAllowedFemales,
    filterAgeRange,
    filterMinDurationM,
    setFilterInterests,
    setFilterLanguages,
    setFilterAllowedMales,
    setFilterAllowedFemales,
    setFilterAgeRange,
    setFilterMinDurationM,
  } = useStore(state => ({
    currentUser: state.currentUser,
    filterInterests: state.filterInterests,
    filterLanguages: state.filterLanguages,
    filterAllowedMales: state.filterAllowedMales,
    filterAllowedFemales: state.filterAllowedFemales,
    filterAgeRange: state.filterAgeRange,
    filterMinDurationM: state.filterMinDurationM,
    setFilterInterests: state.setFilterInterests,
    setFilterLanguages: state.setFilterLanguages,
    setFilterAllowedMales: state.setFilterAllowedMales,
    setFilterAllowedFemales: state.setFilterAllowedFemales,
    setFilterAgeRange: state.setFilterAgeRange,
    setFilterMinDurationM: state.setFilterMinDurationM,
  }))

  // Local interactive state for filters
  const [changedFilterInterests, setChangedFilterInterests] = useState<Interest[]>(filterInterests)
  const [changedFilterLanguages, setChangedFilterLanguages] = useState<string[]>(filterLanguages)
  const [changedFilterAllowedMales, setChangedFilterAllowedMales] = useState<boolean>(filterAllowedMales)
  const [changedFilterAllowedFemales, setChangedFilterAllowedFemales] = useState<boolean>(filterAllowedFemales)
  const [changedFilterAgeRange, setChangedFilterAgeRange] = useState<[number, number]>(filterAgeRange)
  const [changedFilterMinDurationM, setChangedFilterMinDurationM] = useState<number>(filterMinDurationM)

  const [hasChanges, setHasChanges] = useState<boolean>(false)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [activeFiltersSummary, setActiveFiltersSummary] = useState<string>('')

  // Refs for scroll restoration
  const scrollableContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionToRestoreRef = useRef<number | null>(null)
  const bottomBarRef = useRef<HTMLDivElement>(null) // Ref for the bottom bar

  // Sync local state when store's applied filters change (e.g., on init or external update)
  useEffect(() => {
    setChangedFilterInterests([...filterInterests])
    setChangedFilterLanguages([...filterLanguages])
    setChangedFilterAllowedMales(filterAllowedMales)
    setChangedFilterAllowedFemales(filterAllowedFemales)
    setChangedFilterAgeRange([...filterAgeRange] as [number, number])
    setChangedFilterMinDurationM(filterMinDurationM)
  }, [
    filterInterests, 
    filterLanguages, 
    filterAllowedMales, 
    filterAllowedFemales, 
    filterAgeRange, 
    filterMinDurationM
  ])

  // Check for changes between local interactive state and store's applied state
  useEffect(() => {
    const changed =
      changedFilterInterests.join(',') !== filterInterests.join(',') ||
      changedFilterLanguages.join(',') !== filterLanguages.join(',') ||
      changedFilterAllowedMales !== filterAllowedMales ||
      changedFilterAllowedFemales !== filterAllowedFemales ||
      changedFilterAgeRange.join(',') !== filterAgeRange.join(',') ||
      changedFilterMinDurationM !== filterMinDurationM

    if (!hasChanges && changed && isExpanded && scrollableContainerRef.current) {
      // Capturing scroll position just BEFORE `hasChanges` becomes true
      scrollPositionToRestoreRef.current = scrollableContainerRef.current.scrollTop
    }

    setHasChanges(changed)
  }, [
    changedFilterInterests, changedFilterLanguages, changedFilterAllowedMales, changedFilterAllowedFemales, changedFilterAgeRange, changedFilterMinDurationM,
    filterInterests, filterLanguages, filterAllowedMales, filterAllowedFemales, filterAgeRange, filterMinDurationM,
    isExpanded,
    hasChanges
  ])

  useEffect(() => {
    const summaryParts: string[] = []

    // Minimum Duration
    if (changedFilterMinDurationM === 60) {
      summaryParts.push('60min') // As per user request
    }

    // Languages
    const userLanguages = currentUser?.languages || []
    if (userLanguages.length > 1) {
      if (changedFilterLanguages.length > 0 && changedFilterLanguages.length < userLanguages.length) {
        summaryParts.push(changedFilterLanguages.join(', '))
      }
    }

    // Interests
    const allAvailableInterests = Array.from(interestRelationships.keys())
    if (changedFilterInterests.length > 0 && changedFilterInterests.length < allAvailableInterests.length) {
      summaryParts.push(changedFilterInterests.map(interest => t(`Interest.${interest}`)).join(', '))
    }

    // Age Range
    if (changedFilterAgeRange[0] !== 10 || changedFilterAgeRange[1] !== 100) {
      summaryParts.push(`${changedFilterAgeRange[0]}-${changedFilterAgeRange[1]}`)
    }

    // Allowed Genders
    if (!changedFilterAllowedMales && changedFilterAllowedFemales) { // Only females allowed
      summaryParts.push(t('females')) // Assuming t('females') is a concise translation key
    } else if (changedFilterAllowedMales && !changedFilterAllowedFemales) { // Only males allowed
      summaryParts.push(t('males')) // Assuming t('males') is a concise translation key
    }

    setActiveFiltersSummary(summaryParts.join(', '))
  }, [
    changedFilterMinDurationM,
    changedFilterLanguages,
    changedFilterInterests,
    changedFilterAgeRange,
    changedFilterAllowedMales,
    changedFilterAllowedFemales,
    currentUser?.languages,
    t
  ])

  // Effect to restore scroll position when hasChanges becomes true
  useEffect(() => {
    if (hasChanges && isExpanded && scrollableContainerRef.current && scrollPositionToRestoreRef.current !== null) {
      const oldScrollTop = scrollPositionToRestoreRef.current
      const barHeight = bottomBarRef.current?.offsetHeight || 0
      
      // Adjust scrollTop to keep the bottom of the visible content in the same place
      const newScrollTop = oldScrollTop + barHeight

      requestAnimationFrame(() => {
        if (scrollableContainerRef.current) {
          scrollableContainerRef.current.scrollTop = newScrollTop
        }
      })
      // Consume the value after attempting to restore
      scrollPositionToRestoreRef.current = null
    } else if (!hasChanges) {
      // If changes are applied or cancelled, reset the stored scroll position
      scrollPositionToRestoreRef.current = null
    }
  }, [hasChanges, isExpanded])

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
    
    onApplyFilters() // This will trigger the refetch in MeetingsContext
    setHasChanges(false) // Reset after applying
    onToggleFilters(false)
  }

  const handleCancelClick = () => {
    // Reset local state from store
    setChangedFilterInterests([...filterInterests])
    setChangedFilterLanguages([...filterLanguages])
    setChangedFilterAllowedMales(filterAllowedMales)
    setChangedFilterAllowedFemales(filterAllowedFemales)
    setChangedFilterAgeRange([...filterAgeRange] as [number, number])
    setChangedFilterMinDurationM(filterMinDurationM)
    setHasChanges(false)
    onToggleFilters(false)
  }

  return (
    <>
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center mb-4 cursor-pointer" onClick={handleToggleExpand} style={{ userSelect: 'none' }}>
          <IconButton size="small">
            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
          <Typography variant="subtitle1" component="span">
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
            <InterestSelector
              value={changedFilterInterests}
              onChange={setChangedFilterInterests}
              label={t('filterByInterests')}
            />
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

      {/* Apply/Cancel Filter Buttons, shown if local state differs from store */}
      {hasChanges && (
        <div
          ref={bottomBarRef} // Assign ref to the bottom bar
          className="p-3 panel-bg border-t panel-border flex justify-end gap-2 z-20 shadow-lg rounded-md"
          style={{ backgroundColor: 'var(--mui-palette-background-paper)' }}
        >
          <Button onClick={handleCancelClick} variant="outlined">
            {t('cancelChanges')}
          </Button>
          <Button onClick={handleApplyClick} variant="contained" color="primary">
            {t('applyFilters')}
          </Button>
        </div>
      )}
    </>
  )
} 