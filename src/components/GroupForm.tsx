'use client'

import { IconButton, Button, FormGroup, FormControlLabel, Switch, TextField, CircularProgress } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useLocale, useTranslations } from 'next-intl'
import { useUpdateGroup } from '@/hooks/useUpdateGroup'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useStore } from '@/store/useStore'
import { useState, useEffect } from 'react'
import { Group } from '@/generated/graphql'
import { useParams, useRouter } from 'next/navigation'
import { useGroups } from '@/store/GroupsProvider'
import LoadingDialog from './LoadingDialog'
import { useSnackbar } from '@/contexts/SnackContext'
import PageHeader from './PageHeader'
import GroupIcon from '@mui/icons-material/Group'
import InterestsPairsEditor from './InterestsPairsEditor'
import InterestsDescriptionsEditor from './InterestsDescriptionsEditor'

interface InterestDescription {
  interest: string
  description: string
}

export default function GroupForm() {
  const t = useTranslations()
  const { groups, loading: loadingGroups, error: errorGroups, refetch } = useGroups()
  const { id: groupId } = useParams()
  const group = groups?.find(g => g._id === groupId)
  
  const { currentUser, setCurrentUser } = useStore(state => ({ 
    currentUser: state.currentUser, 
    setCurrentUser: state.setCurrentUser 
  }))
  const router = useRouter()
  const locale = useLocale()

  const [name, setName] = useState('')
  const [open, setOpen] = useState(true)
  const [interestsPairs, setInterestsPairs] = useState<string[][]>([])
  const [interestsDescriptions, setInterestsDescriptions] = useState<InterestDescription[]>([])
  const { updateGroup, loading } = useUpdateGroup()
  const { updateUserData } = useUpdateUser()
  const { showSnackbar } = useSnackbar()

  // Reset form when group changes
  useEffect(() => {
    if (group) {
      setName(group.name || '')
      setOpen(group.open !== undefined ? group.open : true)
      setInterestsPairs(group.interestsPairs || [])
      setInterestsDescriptions(group.interestsDescriptions || [])
    } else {
      setName('')
      setOpen(true)
      setInterestsPairs([])
      setInterestsDescriptions([])
    }
  }, [group])

  if (loadingGroups || errorGroups) {
    return <LoadingDialog loading={loadingGroups} error={errorGroups} />
  }

  const handleCancel = () => {
    router.back()
  }

  const handleSave = async () => {
    if (!name.trim()) {
      showSnackbar(t('groupNameRequired', { defaultValue: 'Group name is required' }), 'error')
      return
    }

    // Filter out empty pairs and descriptions
    const validPairs = interestsPairs.filter(pair => pair[0] && pair[1])
    const validDescriptions = interestsDescriptions.filter(desc => desc.description.trim())

    const groupInput = {
      _id: groupId as string || undefined,
      name: name.trim(),
      open,
      admins: group?.admins || [currentUser?._id || ''],
      interestsPairs: validPairs,
      interestsDescriptions: validDescriptions
    }

    try {
      const result = await updateGroup(groupInput)
      if (result) {
        refetch()
        const message = groupId 
          ? t('groupUpdated', { defaultValue: 'Group updated successfully' })
          : t('groupCreated', { defaultValue: 'Group created successfully' })
        showSnackbar(message, 'success')
        router.push(`/${locale}/groups`)
      }
    } catch (error) {
      console.error('Error saving group:', error)
      showSnackbar(t('errorSavingGroup', { defaultValue: 'Error saving group' }), 'error')
    }
  }

  // Sync interest names in descriptions when pairs change
  const handleInterestsPairsChange = (newPairs: string[][]) => {
    // Create mapping of old to new interest names
    const interestChanges: Record<string, string> = {}
    
    // Compare old and new pairs to detect renames
    interestsPairs.forEach((oldPair, pairIndex) => {
      if (newPairs[pairIndex]) {
        const newPair = newPairs[pairIndex]
        // Track renames for both positions in the pair
        if (oldPair[0] && newPair[0] && oldPair[0] !== newPair[0]) {
          interestChanges[oldPair[0]] = newPair[0]
        }
        if (oldPair[1] && newPair[1] && oldPair[1] !== newPair[1]) {
          interestChanges[oldPair[1]] = newPair[1]
        }
      }
    })

    // Update descriptions with new interest names
    if (Object.keys(interestChanges).length > 0) {
      const updatedDescriptions = interestsDescriptions.map(desc => {
        const newInterestName = interestChanges[desc.interest]
        if (newInterestName) {
          return {
            ...desc,
            interest: newInterestName
          }
        }
        return desc
      })
      setInterestsDescriptions(updatedDescriptions)
    }

    setInterestsPairs(newPairs)
  }

  const isFormValid = name.trim().length > 0

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <PageHeader
        icon={<GroupIcon />}
        title={groupId ? t('editGroup', { defaultValue: 'Edit Group' }) : t('createGroup', { defaultValue: 'Create Group' })}
      >
        <IconButton 
          onClick={handleCancel} 
          aria-label={t('close')}
          title={t('close')}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </PageHeader>

      <div className="flex-grow overflow-y-auto p-4">
        <div className="mx-auto space-y-6">
          <TextField
            fullWidth
            label={t('groupName', { defaultValue: 'Group Name' })}
            value={name}
            onChange={(e) => setName(e.target.value)}
            variant="outlined"
            required
            InputLabelProps={{
              className: 'text-gray-300'
            }}
            InputProps={{
              className: 'text-white'
            }}
            className="mb-4"
          />

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={open}
                  onChange={(e) => setOpen(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <div>
                  <div className="text-white">
                    {t('openGroup', { defaultValue: 'Open Group' })}
                  </div>
                  <div className="text-sm text-gray-400">
                    {open 
                      ? t('openGroupDescription', { defaultValue: 'Anyone can join this group' })
                      : t('privateGroupDescription', { defaultValue: 'Only invited members can join' })
                    }
                  </div>
                </div>
              }
            />
          </FormGroup>

          <InterestsPairsEditor
            value={interestsPairs}
            onChange={handleInterestsPairsChange}
          />

          <InterestsDescriptionsEditor
            value={interestsDescriptions}
            onChange={setInterestsDescriptions}
            interestsPairs={interestsPairs}
          />
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2 justify-end">
          <Button
            variant="outlined"
            onClick={handleCancel}
            disabled={loading}
            className="text-white border-gray-600 hover:border-gray-400"
          >
            {t('cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={loading || !isFormValid}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <CircularProgress size={20} className="text-white" />
            ) : (
              groupId ? t('update', { defaultValue: 'Update' }) : t('create', { defaultValue: 'Create' })
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 