'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, Typography, Button, Checkbox, FormControlLabel, FormGroup, Chip, Divider, Switch, IconButton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { InterestsBlock, User } from '@/generated/graphql'
import { useTranslations } from 'next-intl'
import { useStore } from '@/store/useStore'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { LANGUAGES } from '@/config/languages'
import { formatTextWithLinks } from '@/utils/formatTextWithLinks'
import { useMeetings } from '@/contexts/MeetingsContext'
import { useCheckImage } from '@/hooks/useCheckImage'
import InterestSelector from './InterestSelector'
import { useGroups } from '@/store/GroupsProvider'

interface UserDetailsPopupProps {
  user: User
  open: boolean
  onClose: () => void
}

export default function UserDetailsPopup({ user, open, onClose }: UserDetailsPopupProps) {
  const t = useTranslations()
  const { currentUser, setCurrentUser } = useStore(state => ({ 
    currentUser: state.currentUser, 
    setCurrentUser: state.setCurrentUser 
  }))
  const { groups } = useGroups()
  const { updateUserData } = useUpdateUser()
  const [showFullImage, setShowFullImage] = useState(false)
  const { exists: imageExists } = useCheckImage(user._id)

  const existingBlock = currentUser?.blocks.find((b: any) => b.userId === user._id)
  const [blockAll, setBlockAll] = useState(existingBlock?.all || false)
  const [interestsBlocks, setInterestsBlocks] = useState<InterestsBlock[]>(
    existingBlock?.interestsBlocks?.map((ib: any) => ({
      groupId: ib.groupId,
      all: ib.all || false,
      interests: [...(ib.interests || [])]
    })) || []
  )
  const [isEditing, setIsEditing] = useState(false)
  const [isBlockSectionExpanded, setIsBlockSectionExpanded] = useState(false)
  const { refetchFutureMeetingsWithPeers } = useMeetings()

  // Get groups that both users have access to
  const commonGroups = groups?.filter(group => 
    currentUser?.groups?.includes(group._id) && 
    user.groups?.includes(group._id)
  ) || []
  
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (imageExists) {
      setShowFullImage(true)
    }
  }

  const handleGroupInterestsChange = (groupId: string, interests: string[]) => {
    const newInterestsBlocks = interestsBlocks.map(ib => ({ ...ib, interests: [...ib.interests] }))
    const existingIndex = newInterestsBlocks.findIndex(ib => ib.groupId === groupId)
    
    if (interests.length === 0) {
      // Remove the group block if no interests are blocked and 'all' is false
      if (existingIndex !== -1 && !newInterestsBlocks[existingIndex].all) {
        newInterestsBlocks.splice(existingIndex, 1)
      } else if (existingIndex !== -1) {
        // Keep the block but clear specific interests
        newInterestsBlocks[existingIndex].interests = []
      }
    } else {
      // Update or add the group block
      if (existingIndex !== -1) {
        newInterestsBlocks[existingIndex].interests = [...interests]
        newInterestsBlocks[existingIndex].all = false // Reset all flag when selecting specific interests
      } else {
        newInterestsBlocks.push({ groupId, all: false, interests: [...interests] })
      }
    }
    
    setInterestsBlocks(newInterestsBlocks)
    setIsEditing(true)
  }

  const handleBlockAllInGroup = (groupId: string, blockAll: boolean) => {
    const newInterestsBlocks = interestsBlocks.map(ib => ({ 
      groupId: ib.groupId,
      all: ib.all,
      interests: [...ib.interests]
    }))
    const existingIndex = newInterestsBlocks.findIndex(ib => ib.groupId === groupId)
    
    if (blockAll) {
      // Set the 'all' flag to true and clear specific interests
      if (existingIndex !== -1) {
        newInterestsBlocks[existingIndex] = {
          ...newInterestsBlocks[existingIndex],
          all: true,
          interests: []
        }
      } else {
        newInterestsBlocks.push({ groupId, all: true, interests: [] })
      }
    } else {
      // Remove the group block entirely or set all to false
      if (existingIndex !== -1) {
        if (newInterestsBlocks[existingIndex].interests.length === 0) {
          newInterestsBlocks.splice(existingIndex, 1)
        } else {
          newInterestsBlocks[existingIndex] = {
            ...newInterestsBlocks[existingIndex],
            all: false
          }
        }
      }
    }
    
    setInterestsBlocks(newInterestsBlocks)
    setIsEditing(true)
  }

  const isAllBlockedInGroup = (groupId: string): boolean => {
    const groupBlock = interestsBlocks.find(ib => ib.groupId === groupId)
    return groupBlock?.all || false
  }

  const getBlockedInterestsForGroup = (groupId: string): string[] => {
    const groupBlock = interestsBlocks.find(ib => ib.groupId === groupId)
    return groupBlock?.interests || []
  }

  const handleApply = async () => {
    if (!currentUser) return

    const updatedBlocks = currentUser.blocks.filter((b: any) => b.userId !== user._id)
    if (blockAll || interestsBlocks.length > 0) {
      updatedBlocks.push({
        userId: user._id,
        all: blockAll,
        interestsBlocks: interestsBlocks
      })
    }

    setCurrentUser({
      ...currentUser,
      blocks: updatedBlocks
    })
    await updateUserData()
    setIsEditing(false)
    setIsBlockSectionExpanded(false)
    refetchFutureMeetingsWithPeers()
    onClose()
  }

  const handleCancel = () => {
    setBlockAll(existingBlock?.all || false)
    setInterestsBlocks(existingBlock?.interestsBlocks?.map((ib: any) => ({
      groupId: ib.groupId,
      all: ib.all || false,
      interests: ib.interests || []
    })) || [])
    setIsEditing(false)
    setIsBlockSectionExpanded(false)
    onClose()
  }

  const handleToggleBlockSection = () => {
    setIsBlockSectionExpanded(!isBlockSectionExpanded)
  }

  return (
    <>
      <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
        <DialogContent className="space-y-4">
          {/* User Avatar and Basic Info */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative">
              {imageExists ? (
                <img
                  src={`/profiles/${user._id}.jpg`}
                  alt={user.name}
                  className="w-16 h-16 rounded-full object-cover cursor-pointer"
                  onClick={handleImageClick}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-lg font-semibold">
                  {user.name[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div>
              <Typography variant="h6" component="h2">
                {user.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.sex === 'male' ? t('male') : user.sex === 'female' ? t('female') : ''}
              </Typography>
            </div>
          </div>

          {user.languages.length > 0 && (
            <div>
              <Typography variant="subtitle2" className="text-gray-400 mb-2">
                {t('Profile.languages')}
              </Typography>
              <div className="flex flex-wrap gap-1">
                {user.languages.map(lang => {
                  const language = LANGUAGES.find(l => l.code === lang)
                  return (
                    <Chip
                      key={lang}
                      label={language?.name || lang}
                      size="small"
                      className="text-xs"
                    />
                  )
                })}
              </div>
            </div>
          )}

          {user.about && (
            <div>
              <Typography variant="subtitle2" className="text-gray-400 mb-2">
                {t('Profile.about')}
              </Typography>
              <Typography className="whitespace-pre-wrap">
                {formatTextWithLinks(user.about)}
              </Typography>
            </div>
          )}

          {user.contacts && (
            <div>
              <Typography variant="subtitle2" className="text-gray-400 mb-2">
                {t('Profile.contacts')}
              </Typography>
              <Typography className="whitespace-pre-wrap">
                {formatTextWithLinks(user.contacts)}
              </Typography>
            </div>
          )}

          {/* Collapsible Block controls section */}
          <Divider className="my-4" />
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center py-2" style={{ userSelect: 'none' }}>
              <IconButton 
                size="small" 
                onClick={handleToggleBlockSection} 
                aria-label={isBlockSectionExpanded ? t('collapseBlockControls') : t('expandBlockControls')}
              >
                {isBlockSectionExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </IconButton>
              <Typography variant="subtitle1" component="span" onClick={handleToggleBlockSection} className="cursor-pointer">
                {t('blockControls')}
              </Typography>
            </div>

            {isBlockSectionExpanded && (
              <div className="flex-grow overflow-y-auto flex flex-col gap-4 px-8 py-0 pb-4">
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={blockAll}
                  onChange={(e) => {
                    setBlockAll(e.target.checked)
                    setIsEditing(true)
                  }}
                  className="text-red-500"
                />
              }
              label={t('blockUser')}
            />
          </FormGroup>

          {!blockAll && commonGroups.length > 0 && (
            <>
              {commonGroups.map(group => (
                <div key={group._id} className="mb-4">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isAllBlockedInGroup(group._id)}
                        onChange={(e) => handleBlockAllInGroup(group._id, e.target.checked)}
                        color="warning"
                      />
                    }
                    label={`${t('blockAllInterestsIn')} ${group.name}`}
                    className="mb-2"
                  />
                  {!isAllBlockedInGroup(group._id) && (
                    <InterestSelector
                      value={getBlockedInterestsForGroup(group._id)}
                      onChange={(interests) => handleGroupInterestsChange(group._id, interests)}
                      label={`${t('blockInterestsIn')} ${group.name}`}
                      interestsPairs={group.interestsPairs || []}
                    />
                  )}
                </div>
              ))}
            </>
          )}
              </div>
            )}
          </div>

          {/* Action buttons - shown when expanded and editing */}
          {isBlockSectionExpanded && isEditing && (
            <div 
              className="p-3 panel-bg border-t panel-border flex justify-end gap-2 z-20 shadow-lg rounded-md"
              style={{ backgroundColor: 'var(--mui-palette-background-paper)' }}
            >
              <Button onClick={handleCancel} variant="outlined">
                {t('cancel')}
              </Button>
              <Button 
                onClick={handleApply}
                variant="contained"
                color="primary"
              >
                {t('apply')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full screen image dialog */}
      {showFullImage && (
        <Dialog
          open={showFullImage}
          onClose={() => setShowFullImage(false)}
          maxWidth={false}
          fullWidth
        >
          <DialogContent className="p-0">
            <img
              src={`/profiles/${user._id}.jpg`}
              alt={user.name}
              className="w-full h-auto max-h-screen object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
} 