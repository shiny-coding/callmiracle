'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { routerPush } from '@/utils/routerHelper'
import {
  Paper,
  Typography,
  Button,
  FormGroup,
  FormControlLabel,
  Divider,
  CircularProgress,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Select,
  MenuItem,
  Alert,
  TextField
} from '@mui/material'
import LanguageSelector from '@/components/LanguageSelector'
import GroupCard from '@/components/GroupCard'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useStore } from '@/store/useStore'
import { useGroups } from '@/store/GroupsProvider'
import { Group } from '@/generated/graphql'
import { LANGUAGES } from '@/config/languages'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import LocaleSwitch from '@/components/LocaleSwitch'

export default function FirstTimePage() {
  const t = useTranslations('FirstTime')
  const router = useRouter()
  const locale = useLocale()
  const { currentUser, setCurrentUser } = useStore(state => ({
    currentUser: state.currentUser,
    setCurrentUser: state.setCurrentUser
  }))
  const { updateUserData, loading: updateLoading } = useUpdateUser()
  const { groups, loading: groupsLoading } = useGroups()
  const { update: updateSession } = useSession()
  

  const [name, setName] = useState<string>('')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedSex, setSelectedSex] = useState<string>('')
  const [selectedBirthYear, setSelectedBirthYear] = useState<number | null>(null)
  const [showWarning, setShowWarning] = useState(false)

  // Initialize name from currentUser
  useEffect(() => {
    if (currentUser?.name && !name) {
      setName(currentUser.name)
    }
  }, [currentUser?.name])

  // Filter public groups based on selected languages
  const publicGroups = groups?.filter(group => 
    group.open && selectedLanguages.includes(group.language)
  ) || []

  // Generate years array for birth year selection
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 80 }, (_, i) => currentYear - i - 10)

  // Initialize selectedGroupIds with user's existing groups that are public and match selected languages
  useEffect(() => {
    if (currentUser?.groups && publicGroups.length > 0) {
      const userGroupIds = currentUser.groups;
      const matchingGroupIds = publicGroups
        .filter(group => userGroupIds.includes(group._id))
        .map(group => group._id);
      
      // Only update state if there are matching groups and the current selection is empty
      // This prevents infinite update loops
      if (matchingGroupIds.length > 0 && selectedGroupIds.length === 0) {
        setSelectedGroupIds(matchingGroupIds);
      }
    }
  }, [currentUser?.groups, publicGroups, selectedGroupIds.length])

  // Auto-detect user's browser languages on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedLanguages.length === 0) {
      const detectedLanguages = new Set<string>()

      // First, add user's selected interface locale if it exists
      if (currentUser?.locale) {
        const localeMatch = LANGUAGES.find(l => l.code === currentUser.locale)
        if (localeMatch) {
          detectedLanguages.add(localeMatch.code)
        }
      }

      // Then auto-detect from browser languages
      const browserLangs = navigator.languages || [navigator.language]
      for (const lang of browserLangs) {
        const langCode = lang.toLowerCase().split('-')[0]
        const match = LANGUAGES.find(l => l.code === langCode)
        if (match) detectedLanguages.add(match.code)
      }

      if (detectedLanguages.size > 0) {
        setSelectedLanguages(Array.from(detectedLanguages))
      }
    }
  }, [currentUser?.locale])

  // Reset selected groups when languages change
  useEffect(() => {
    // Only reset if we already had some groups selected and languages changed
    if (selectedGroupIds.length > 0) {
      setSelectedGroupIds([])
      setShowWarning(false)
    }
  }, [selectedLanguages])

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
    setShowWarning(false)
  }

  const handleNext = async () => {
    if (selectedLanguages.length === 0 || !selectedSex || !selectedBirthYear || !name.trim()) {
      return // Button should be disabled
    }

    // If there are available groups but none selected, show warning
    if (publicGroups.length > 0 && selectedGroupIds.length === 0) {
      setShowWarning(true)
      return
    }

    if (!currentUser) return

    try {
      // Get current user groups
      const currentGroups = currentUser.groups || []

      // Create a set of unique group IDs (combining existing and newly selected)
      const uniqueGroupIds = Array.from(new Set([
        ...currentGroups,
        ...selectedGroupIds
      ]))

      // Update user with name, selected languages, sex, birth year, and groups
      const updatedUser = {
        ...currentUser,
        name: name.trim(),
        languages: selectedLanguages,
        sex: selectedSex,
        birthYear: selectedBirthYear,
        groups: uniqueGroupIds
      }
      
      setCurrentUser(updatedUser)
      await updateUserData() // This will now automatically update the session/JWT token

      try {
        await updateSession()
      } catch (error) {
        console.error('Error updating session:', error)
      }
      
      // Navigate to calendar - the JWT token should now have the updated languages
      routerPush(router, `/${locale}/calendar`, {
        source: 'first_time_setup_complete',
        selectedGroups: selectedGroupIds,
        profileData: { name }
      })
      
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const isNextDisabled = selectedLanguages.length === 0 || !selectedSex || !selectedBirthYear || !name.trim() || updateLoading

  return (
    <div className="h-full flex flex-col">
      <Paper className="h-full flex flex-col">
        <div className="flex-grow overflow-y-auto p-4">
          {/* App Icon and Name */}
          <div className="flex justify-center mb-4">
            <div
              className="inline-grid items-center gap-4"
              style={{ gridTemplateColumns: 'auto 1fr auto' }}
            >
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
                  <Image
                    src="/logo-192.png"
                    alt="CallMiracle"
                    width={64}
                    height={64}
                    className="w-full h-full"
                    unoptimized
                  />
                </div>
              </div>
              <div className="flex justify-center">
                <Typography variant="h4" className="font-bold text-slate-900 text-center">
                  CallMiracle
                </Typography>
              </div>
              <div className="w-16" aria-hidden="true" />
            </div>
          </div>

          {/* Locale Switch */}
          <div className="flex justify-center mb-6">
            <LocaleSwitch />
          </div>

          <Typography variant="h5" className="mb-6 text-center" sx={{ whiteSpace: 'pre-line' }}>
            {t('title')}
          </Typography>

          {/* Name Section */}
          <div className="mb-6">
            <Typography variant="h6" className="mb-2" sx={{ paddingTop: '0.2rem' }}>
              {t('nameTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" className="mb-4" sx={{ paddingBottom: '0.5rem' }}>
              {t('nameDescription')}
            </Typography>
            <TextField
              fullWidth
              required
              label={t('name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!name.trim() && name.length > 0}
              helperText={!name.trim() && name.length > 0 ? t('nameRequired') : ''}
            />
          </div>

          <Divider className="my-6" />

          {/* Languages Section */}
          <div className="mb-8">
            <Typography variant="h6" className="mb-2" sx={{ paddingTop: '0.2rem' }}>
              {t('languagesTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" className="mb-4" sx={{ paddingBottom: '0.5rem' }}>
              {t('languagesDescription')}
            </Typography>
            
            <LanguageSelector
              value={selectedLanguages}
              onChange={setSelectedLanguages}
              showQuickSelectors={true}
            />
            
            {selectedLanguages.length === 0 && (
              <Typography color="error" className="text-sm mt-2">
                {t('pleaseSelectLanguages')}
              </Typography>
            )}
          </div>

          <Divider className="my-6" />

          {/* Sex and Birth Year Section */}
          <div className="mb-8">
            <Typography variant="h6" className="mb-2" sx={{ paddingTop: '0.2rem' }}>
              {t('personalInfoTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" className="mb-4" sx={{ paddingBottom: '0.5rem' }}>
              {t('personalInfoDescription')}
            </Typography>

            {/* Sex Selection */}
            <FormControl component="fieldset" className="mb-4 w-full">
              <FormLabel component="legend" required>{t('sex')}</FormLabel>
              <RadioGroup
                row
                value={selectedSex}
                onChange={(e) => setSelectedSex(e.target.value)}
              >
                <FormControlLabel 
                  value="female" 
                  control={<Radio />} 
                  label={t('female')} 
                />
                <FormControlLabel 
                  value="male" 
                  control={<Radio />} 
                  label={t('male')} 
                />
              </RadioGroup>
              {!selectedSex && (
                <Typography color="error" className="text-sm mt-1">
                  {t('pleaseSelectSex')}
                </Typography>
              )}
            </FormControl>

            {/* Birth Year Selection */}
            <FormControl fullWidth className="mb-4">
              <FormLabel component="legend" required sx={{ paddingBottom: '0.5rem' }}>{t('birthYear')}</FormLabel>
              <Select
                value={selectedBirthYear || ''}
                onChange={(e) => setSelectedBirthYear(Number(e.target.value) || null)}
                displayEmpty
              >
                <MenuItem value="">{t('selectYear')}</MenuItem>
                {years.map(year => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
              {!selectedBirthYear && (
                <Typography color="error" className="text-sm mt-1" sx={{ paddingTop: '0.5rem' }}>
                  {t('pleaseSelectBirthYear')}
                </Typography>
              )}
            </FormControl>
          </div>

          <Divider className="my-6" />

          {/* Groups Section */}
          {selectedLanguages.length > 0 && (
            <div className="mb-8">
              <Typography variant="h6" className="mb-2" sx={{ paddingTop: '0.2rem' }}>
                {t('groupsTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" className="mb-4" sx={{ paddingBottom: '0.5rem' }}>
                {t('groupsDescription')}
              </Typography>

              {groupsLoading ? (
                <div className="flex justify-center py-8">
                  <CircularProgress />
                </div>
              ) : publicGroups.length === 0 ? (
                <Typography color="text.secondary" className="text-center py-8 italic">
                  {t('noGroupsMessage')}
                </Typography>
              ) : (
                <div className="flex flex-col gap-12sp px-12sp pb-20sp">
                  {publicGroups.map((group: Group) => (
                    <div key={group._id} className="card-bg rounded-lg" style={{ padding: '1rem' }}>
                      <GroupCard
                        group={group}
                        firstTime={true}
                        checked={selectedGroupIds.includes(group._id)}
                        onToggle={handleGroupToggle}
                      />
                    </div>
                  ))}
                </div>
              )}

              {showWarning && (
                <Alert severity="warning" className="mt-4">
                  {t('noGroupsSelectedWarning')}
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t panel-border">
          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={isNextDisabled}
            onClick={handleNext}
            startIcon={updateLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {updateLoading ? t('saving') : t('continue')}
          </Button>
        </div>
      </Paper>
    </div>
  )
} 