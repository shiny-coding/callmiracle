'use client'

import { IconButton, Button, FormGroup, FormControlLabel, Switch, TextField, Snackbar, Alert } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useLocale, useTranslations } from 'next-intl'
import { useUpdateGroup } from '@/hooks/useUpdateGroup'
import { useStore } from '@/store/useStore'
import { useState, useEffect } from 'react'
import { Group } from '@/generated/graphql'
import CircularProgress from '@mui/material/CircularProgress'
import { useParams, useRouter } from 'next/navigation'
import { useGroups } from '@/store/GroupsProvider'
import LoadingDialog from './LoadingDialog'
import { useSnackbar } from '@/contexts/SnackContext'
import PageHeader from './PageHeader'
import GroupIcon from '@mui/icons-material/Group'

export default function GroupForm() {
  const t = useTranslations()
  const { groups, loading: loadingGroups, error: errorGroups, refetch } = useGroups()
  const { id: groupId } = useParams()
  const group = groups?.find(g => g._id === groupId)
  
  const { currentUser } = useStore(state => ({ currentUser: state.currentUser }))
  const router = useRouter()
  const locale = useLocale()

  const [name, setName] = useState('')
  const [open, setOpen] = useState(true)
  const { updateGroup, loading } = useUpdateGroup()
  const { showSnackbar } = useSnackbar()

  // Reset form when group changes
  useEffect(() => {
    if (group) {
      setName(group.name || '')
      setOpen(group.open !== undefined ? group.open : true)
    } else {
      setName('')
      setOpen(true)
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

    const groupInput = {
      _id: groupId as string || undefined,
      name: name.trim(),
      open,
      admins: group?.admins || [currentUser?._id || ''] // Keep existing admins or make current user admin
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
        <div className="max-w-md mx-auto space-y-6">
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