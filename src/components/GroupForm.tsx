'use client'

import { IconButton, Button, FormGroup, FormControlLabel, Switch, TextField, CircularProgress, Autocomplete, Chip, Box, InputAdornment, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteIcon from '@mui/icons-material/Delete'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useUpdateGroup } from '@/hooks/useUpdateGroup'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useInitUser } from '@/hooks/useInitUser'
import { useRegenerateJoinToken } from '@/hooks/useRegenerateJoinToken'
import { useUsers } from '@/store/UsersProvider'
import { useStore } from '@/store/useStore'
import { useState, useEffect } from 'react'
import { Group, User, MeetingTransparency } from '@/generated/graphql'
import { useParams, useRouter } from 'next/navigation'
import { useGroups } from '@/store/GroupsProvider'
import LoadingDialog from './LoadingDialog'
import { routerPush } from '@/utils/routerHelper'
import { useSnackbar } from '@/contexts/SnackContext'
import PageHeader from './PageHeader'
import GroupIcon from '@mui/icons-material/Group'
import InterestsPairsEditor from './InterestsPairsEditor'
import InterestsDescriptionsEditor from './InterestsDescriptionsEditor'
import LanguageSelector from './LanguageSelector'
import { useDropzone } from 'react-dropzone'
import { useCallback } from 'react'
import { useGroupImage } from '@/hooks/useGroupImage'

interface InterestDescription {
  interest: string
  description: string
}

export default function GroupForm() {
  const t = useTranslations()
  const { groups, loading: loadingGroups, error: errorGroups, refetch } = useGroups()
  const { users, loading: loadingUsers } = useUsers()
  const { refetch: refetchUser } = useInitUser()
  const { id: groupId } = useParams()
  const group = groups?.find(g => g._id === groupId)
  
  const { currentUser, setCurrentUser } = useStore(state => ({ 
    currentUser: state.currentUser, 
    setCurrentUser: state.setCurrentUser 
  }))
  const router = useRouter()
  const locale = useLocale()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [open, setOpen] = useState(true)
  const [transparency, setTransparency] = useState<MeetingTransparency>(MeetingTransparency.Transparent)
  const [selectedAdmins, setSelectedAdmins] = useState<User[]>([])
  const [language, setLanguage] = useState<string>(() => {
    // Default to current user's first language if available, otherwise 'ru'
    return currentUser?.languages?.[0] || locale || 'ru'
  })
  const [interestsPairs, setInterestsPairs] = useState<string[][]>([])
  const [interestsDescriptions, setInterestsDescriptions] = useState<InterestDescription[]>([])
  const [isGeneratingToken, setIsGeneratingToken] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageDeleted, setImageDeleted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [timestamp, setTimestamp] = useState(Date.now())
  const { updateGroup, loading } = useUpdateGroup()
  const { updateUserData } = useUpdateUser()
  const { regenerateJoinToken } = useRegenerateJoinToken()
  const { showSnackbar } = useSnackbar()
  const { imageSrc: existingImageSrc } = useGroupImage(groupId as string, timestamp)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    setSelectedFile(acceptedFiles[0])
    setImageDeleted(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    },
    maxFiles: 1
  })

  // Reset form when group changes
  useEffect(() => {
    if (group && users) {
      setName(group.name || '')
      setDescription(group.description || '')
      setOpen(group.open !== undefined ? group.open : true)
      setTransparency(group.transparency || MeetingTransparency.Transparent)
      setLanguage(group.language || 'ru')
      setInterestsPairs(group.interestsPairs || [])
      setInterestsDescriptions(group.interestsDescriptions || [])
      
      // Set selected administrators based on group.admins
      const adminUsers = users.filter(user => group.admins.includes(user._id))
      setSelectedAdmins(adminUsers)
    } else if (!group) {
      setName('')
      setDescription('')
      setOpen(true)
      setTransparency(MeetingTransparency.Transparent)
      // Use current user's first language or interface locale for new groups
      setLanguage(currentUser?.languages?.[0] || locale || 'ru')
      setInterestsPairs([])
      setInterestsDescriptions([])
      // For new groups, set current user as default admin
      if (currentUser) {
        setSelectedAdmins([currentUser])
      }
    }
  }, [group, users, currentUser])

  if (loadingGroups || loadingUsers || errorGroups) {
    return <LoadingDialog loading={loadingGroups || loadingUsers} error={errorGroups} />
  }

  // Filter users to exclude deleted ones and ensure current user is available
  const availableUsers = users?.filter(user => !user.deleted) || []

  const handleCancel = () => {
    router.back()
  }

  const handleSave = async () => {
    if (!name.trim()) {
      showSnackbar(t('groupNameRequired'), 'error')
      return
    }

    setUploading(true)

    try {
      // Filter out empty pairs and descriptions
      const validPairs = interestsPairs.filter(pair => pair[0] && pair[1])
      const validDescriptions = interestsDescriptions.filter(desc => desc.description.trim())

      const groupInput = {
        _id: groupId as string || undefined,
        name: name.trim(),
        description: description.trim(),
        open,
        transparency,
        admins: selectedAdmins.map(admin => admin._id),
        language,
        interestsPairs: validPairs,
        interestsDescriptions: validDescriptions
      }

      const result = await updateGroup(groupInput)
      if (result) {
        const savedGroupId = result._id

        // Handle image deletion first
        if (imageDeleted && groupId) {
          await fetch('/api/delete-image', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ entityId: savedGroupId, entityType: 'group' }),
          })
          setTimestamp(Date.now())
        }

        // Handle image upload
        if (selectedFile) {
          const formData = new FormData()
          formData.append('image', selectedFile)
          formData.append('entityId', savedGroupId)
          formData.append('entityType', 'group')

          await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
          })
          setTimestamp(Date.now())
        }

        refetch()
        // Refetch user data to update current user's groups array
        if (!groupId) {
          // Only refetch user data when creating a new group (not updating)
          await refetchUser()
        }
        showSnackbar(
          groupId
            ? t('groupUpdated')
            : t('groupCreated'),
          'success'
        )
        routerPush(router, `/${locale}/groups`, {
          source: 'group_form_save_success',
          groupId: savedGroupId,
          operationType: groupId ? 'update' : 'create',
          locale
        })
      }
    } catch (error) {
      console.error('Error saving group:', error)
      showSnackbar(t('errorSavingGroup'), 'error')
    } finally {
      setUploading(false)
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

    // Get all unique interests from new pairs
    const newInterests = new Set<string>()
    newPairs.forEach(pair => {
      if (pair[0]) newInterests.add(pair[0])
      if (pair[1]) newInterests.add(pair[1])
    })

    // Update descriptions: rename existing ones and remove orphaned ones
    let updatedDescriptions = interestsDescriptions.map(desc => {
      const newInterestName = interestChanges[desc.interest]
      if (newInterestName) {
        return {
          ...desc,
          interest: newInterestName
        }
      }
      return desc
    })

    // Remove descriptions for interests that no longer exist in any pair
    updatedDescriptions = updatedDescriptions.filter(desc => 
      newInterests.has(desc.interest)
    )

    setInterestsDescriptions(updatedDescriptions)
    setInterestsPairs(newPairs)
  }

  // Handle reordering of pairs and maintain description connections
  const handlePairReorder = (newPairs: string[][]) => {
    // Reorder descriptions list to follow new order of interests in pairs
    const newOrder: string[] = []
    newPairs.forEach(pair => {
      if (pair[0]) newOrder.push(pair[0])
      if (pair[1]) newOrder.push(pair[1])
    })

    const reordered = [...interestsDescriptions].sort((a, b) => {
      const posA = newOrder.indexOf(a.interest)
      const posB = newOrder.indexOf(b.interest)
      return (posA === -1 ? Number.MAX_SAFE_INTEGER : posA) - (posB === -1 ? Number.MAX_SAFE_INTEGER : posB)
    })

    setInterestsPairs(newPairs)
    setInterestsDescriptions(reordered)
  }

  // Generate join link
  const generateJoinLink = (joinToken: string | null | undefined) => {
    if (!joinToken || !groupId) return ''
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `${baseUrl}/api/join-group?groupId=${groupId}&joinToken=${joinToken}`
  }

  const handleCopyJoinLink = () => {
    const joinLink = generateJoinLink(group?.joinToken)
    if (joinLink) {
      navigator.clipboard.writeText(joinLink)
      showSnackbar(t('joinLinkCopied'), 'success')
    }
  }

  const handleGenerateJoinToken = async () => {
    if (!group) return

    setIsGeneratingToken(true)
    try {
      const result = await regenerateJoinToken(group._id)

      if (result) {
        refetch() // Refresh groups to get the new token
        showSnackbar(t('joinTokenGenerated'), 'success')
      }
    } catch (error) {
      console.error('Error generating join token:', error)
      showSnackbar(t('errorGeneratingJoinToken'), 'error')
    } finally {
      setIsGeneratingToken(false)
    }
  }

  const handleDeletePhoto = () => {
    setImageDeleted(true)
    setSelectedFile(null)
  }

  const isFormValid = name.trim().length > 0 && language.length > 0

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white relative">
      {/* Loader Overlay */}
      {uploading && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60"
          style={{ pointerEvents: 'all' }}
        >
          <CircularProgress color="inherit" />
        </div>
      )}

      <PageHeader
        icon={<GroupIcon />}
        title={groupId ? t('editGroup') : t('createGroup')}
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
          {/* Group Image Upload */}
          <div className="relative flex justify-center items-center">
            <div
              {...getRootProps()}
              className={`
                w-full aspect-square max-w-[240px] mx-auto rounded-full border-2 border-dashed
                ${isDragActive ? 'border-blue-500' : 'border-gray-300'}
                flex items-center justify-center cursor-pointer overflow-hidden
                hover:border-blue-500 transition-colors
              `}
            >
              <input {...getInputProps()} />
              <div className="relative w-full h-full">
                {(selectedFile || (existingImageSrc && !imageDeleted)) ? (
                  <Image
                    src={selectedFile ? URL.createObjectURL(selectedFile) : existingImageSrc!}
                    alt={t('groupImage')}
                    fill
                    unoptimized
                    className="object-cover rounded-full"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm px-4">
                    {uploading ? t('uploading') : t('uploadGroupImage')}
                  </div>
                )}
              </div>
            </div>

            {(selectedFile || (existingImageSrc && !imageDeleted)) && (
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeletePhoto()
                }}
                className="absolute right-0 top-0 bg-red-500/50 hover:bg-red-500/70"
              >
                <DeleteIcon className="text-white" />
              </IconButton>
            )}
          </div>

          <TextField
            fullWidth
            label={t('groupName')}
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

          <TextField
            fullWidth
            label={t('groupDescription')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            variant="outlined"
            multiline
            rows={3}
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
                    {t('openGroup')}
                  </div>
                  <div className="text-sm text-gray-400">
                    {open 
                      ? t('openGroupDescription')
                      : t('privateGroupDescription')
                    }
                  </div>
                </div>
              }
            />
          </FormGroup>

          <FormControl fullWidth className="mb-4">
            <InputLabel className="text-gray-300">{t('groupTransparency')}</InputLabel>
            <Select
              value={transparency}
              onChange={(e) => setTransparency(e.target.value as MeetingTransparency)}
              variant="outlined"
              className="text-white"
            >
              <MenuItem value={MeetingTransparency.Transparent}>
                <div>
                  <div>{t('transparentGroup')}</div>
                  <div className="text-sm text-gray-400">{t('transparentGroupDescription')}</div>
                </div>
              </MenuItem>
              <MenuItem value={MeetingTransparency.Mixed}>
                <div>
                  <div>{t('mixedGroup')}</div>
                  <div className="text-sm text-gray-400">{t('mixedGroupDescription')}</div>
                </div>
              </MenuItem>
              <MenuItem value={MeetingTransparency.Opaque}>
                <div>
                  <div>{t('opaqueGroup')}</div>
                  <div className="text-sm text-gray-400">{t('opaqueGroupDescription')}</div>
                </div>
              </MenuItem>
            </Select>
          </FormControl>

          <div className="space-y-2">
            <LanguageSelector
              value={[language]}
              onChange={(languages) => setLanguage(languages[0] || 'ru')}
              label={t('groupLanguage')}
            />
            <div className="text-sm text-gray-400">
              {t('groupLanguageDescription')}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-white text-sm font-medium">
              {t('administrators')}
            </label>
            <Autocomplete
              multiple
              options={availableUsers}
              value={selectedAdmins}
              onChange={(_, newValue) => setSelectedAdmins(newValue)}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('searchAndSelectAdministrators')}
                  variant="outlined"
                  InputLabelProps={{
                    className: 'text-gray-300'
                  }}
                  InputProps={{
                    ...params.InputProps,
                    className: 'text-white'
                  }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index })
                  return (
                    <Chip
                      key={key}
                      label={option.name}
                      {...tagProps}
                      className="bg-blue-600 text-white"
                    />
                  )
                })
              }
              filterOptions={(options, { inputValue }) => {
                return options.filter(option =>
                  option.name.toLowerCase().includes(inputValue.toLowerCase())
                )
              }}
              className="mb-4"
            />
            <div className="text-sm text-gray-400">
              {t('administratorsDescription')}
            </div>
          </div>

          {/* Join Link Section - Only show for existing groups */}
          {groupId && group && (
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">
                {t('joinLink')}
              </label>
              <div className="flex flex-wrap gap-2">
                <TextField
                  fullWidth
                  value={generateJoinLink(group.joinToken)}
                  variant="outlined"
                  InputProps={{
                    readOnly: true,
                    className: 'text-white',
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleCopyJoinLink}
                          disabled={!group.joinToken}
                          title={t('copyJoinLink')}
                          className="text-gray-400 hover:text-white"
                        >
                          <ContentCopyIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  InputLabelProps={{
                    className: 'text-gray-300'
                  }}
                  className="flex-1 min-w-0"
                />
                <Button
                  variant="outlined"
                  onClick={handleGenerateJoinToken}
                  disabled={isGeneratingToken}
                  className="text-white border-gray-600 hover:border-gray-400 whitespace-nowrap flex-shrink-0"
                >
                  {isGeneratingToken ? (
                    <CircularProgress size={20} className="text-white" />
                  ) : (
                    <>
                      <RefreshIcon className="mr-2" />
                      {group.joinToken ? t('regenerateJoinToken') : t('generateJoinToken')}
                    </>
                  )}
                </Button>
              </div>
              <div className="text-sm text-gray-400">
                {t('joinLinkDescription')}
              </div>
            </div>
          )}

          <InterestsPairsEditor
            value={interestsPairs}
            onChange={handleInterestsPairsChange}
            onReorder={handlePairReorder}
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
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={loading || uploading || !isFormValid}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <CircularProgress size={20} className="text-white" />
            ) : (
              groupId ? t('update') : t('create')
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 