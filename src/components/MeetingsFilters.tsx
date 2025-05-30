'use client'

import { Button, Checkbox, FormControlLabel, FormGroup, Slider, Typography } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Interest } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import InterestSelector from './InterestSelector'
import LanguageSelector from './LanguageSelector'
import { useEffect, useState, useCallback } from 'react'

interface MeetingsFiltersProps {
  onApplyFilters: () => void // Callback to trigger refetch in context
  onFiltersChangedState: (changed: boolean) => void // Callback to inform parent about changes
}

export default function MeetingsFilters({ onApplyFilters, onFiltersChangedState }: MeetingsFiltersProps) {
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
    setHasChanges(changed)
    onFiltersChangedState(changed) // Inform parent
  }, [
    changedFilterInterests, changedFilterLanguages, changedFilterAllowedMales, changedFilterAllowedFemales, changedFilterAgeRange, changedFilterMinDurationM,
    filterInterests, filterLanguages, filterAllowedMales, filterAllowedFemales, filterAgeRange, filterMinDurationM,
    onFiltersChangedState
  ])


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
    onFiltersChangedState(false)
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
    onFiltersChangedState(false)
  }

  return (
    <>
      <div className="p-4 border-b panel-border mb-4 flex flex-col gap-4">
        <Typography variant="subtitle1">{t('filterMeetings')}</Typography>
        <InterestSelector
          value={changedFilterInterests}
          onChange={setChangedFilterInterests}
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
          <div className="w-full px-2">
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
          <Typography variant="subtitle1" className="mb-2">
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

      {/* Apply/Cancel Filter Buttons, shown if local state differs from store */}
      {hasChanges && (
        <div
          className="absolute bottom-4 right-4 left-4 p-3 panel-bg border-t panel-border flex justify-end gap-2 z-20 shadow-lg rounded-md"
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