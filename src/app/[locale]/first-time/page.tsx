'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { 
  Paper, 
  Typography, 
  Button, 
  FormGroup, 
  FormControlLabel, 
  Checkbox,
  Divider,
  CircularProgress
} from '@mui/material'
import LanguageSelector from '@/components/LanguageSelector'
import GroupCard from '@/components/GroupCard'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useStore } from '@/store/useStore'
import { useGroups } from '@/store/GroupsProvider'
import { Group } from '@/generated/graphql'
import { LANGUAGES } from '@/config/languages'
import { useSession } from 'next-auth/react'

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
  

  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [showWarning, setShowWarning] = useState(false)

  // Filter public groups based on selected languages
  const publicGroups = groups?.filter(group => 
    group.open && selectedLanguages.includes(group.language)
  ) || []

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
      const browserLangs = navigator.languages || [navigator.language]
      const detectedLanguages = new Set<string>()
      
      for (const lang of browserLangs) {
        const langCode = lang.toLowerCase().split('-')[0]
        const match = LANGUAGES.find(l => l.code === langCode)
        if (match) detectedLanguages.add(match.code)
      }
      
      if (detectedLanguages.size > 0) {
        setSelectedLanguages(Array.from(detectedLanguages))
      }
    }
  }, [])

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
    if (selectedLanguages.length === 0) {
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
      
      // Update user with selected languages and groups
      const updatedUser = {
        ...currentUser,
        languages: selectedLanguages,
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
      router.push(`/${locale}/calendar`)
      
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const isNextDisabled = selectedLanguages.length === 0 || updateLoading

  return (
    <div className="h-full flex flex-col">
      <Paper className="h-full flex flex-col">
        <div className="flex-grow overflow-y-auto p-6">
          <Typography variant="h4" className="mb-6 text-center">
            {t('title')}
          </Typography>

          {/* Languages Section */}
          <div className="mb-8">
            <Typography variant="h6" className="mb-2">
              {t('languagesTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" className="mb-4">
              {t('languagesDescription')}
            </Typography>
            
            <LanguageSelector
              value={selectedLanguages}
              onChange={setSelectedLanguages}
            />
            
            {selectedLanguages.length === 0 && (
              <Typography color="error" className="text-sm mt-2">
                {t('pleaseSelectLanguages')}
              </Typography>
            )}
          </div>

          <Divider className="my-6" />

          {/* Groups Section */}
          {selectedLanguages.length > 0 && (
            <div className="mb-8">
              <Typography variant="h6" className="mb-2">
                {t('groupsTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" className="mb-4">
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
                <div className="space-y-4">
                  {publicGroups.map((group: Group) => (
                    <div key={group._id} className="flex items-start gap-3">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedGroupIds.includes(group._id)}
                            onChange={() => handleGroupToggle(group._id)}
                          />
                        }
                        label=""
                        className="m-0"
                      />
                      <div className="flex-grow">
                        <GroupCard group={group} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Next button */}
        <div className="sticky bottom-0 left-0 w-full normal-bg border-t panel-border px-6 py-4 flex justify-between items-center">
          <div className="flex flex-col gap-1">
            {showWarning && (
              <Typography color="warning" className="text-sm">
                {t('warningSelectGroup')}
              </Typography>
            )}
          </div>
          
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isNextDisabled}
            className="ml-auto"
          >
            {updateLoading ? <CircularProgress size={20} /> : t('next')}
          </Button>
        </div>
      </Paper>
    </div>
  )
} 