'use client'

import { Typography, Button, Paper, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip, Checkbox } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Group } from '@/generated/graphql'
import GroupIcon from '@mui/icons-material/Group'
import LockIcon from '@mui/icons-material/Lock'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import PeopleIcon from '@mui/icons-material/People'
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useUpdateGroup } from '@/hooks/useUpdateGroup'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useSnackbar } from '@/contexts/SnackContext'
import { routerPush } from '@/utils/routerHelper'
import { useGroups } from '@/store/GroupsProvider'
import { LANGUAGES } from '@/config/languages'
import { useGroupImage } from '@/hooks/useGroupImage'
import Image from 'next/image'

interface GroupCardProps {
  group: Group
  firstTime?: boolean
  checked?: boolean
  onToggle?: (groupId: string) => void
}

export default function GroupCard({ group, firstTime = false, checked = false, onToggle }: GroupCardProps) {
  const t = useTranslations()
  const { currentUser, setCurrentUser } = useStore( (state: any) => ({
    currentUser: state.currentUser,
    setCurrentUser: state.setCurrentUser
  }))
  const { updateUserData, loading: updateLoading } = useUpdateUser()
  const { refetch } = useGroups()
  const { showSnackbar } = useSnackbar()
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<'join' | 'leave'>('join')
  const router = useRouter()
  const locale = useLocale()

  // Check if user is already in this group
  const isInGroup = currentUser?.groups?.includes(group._id) || false

  // Check if user is admin of this group
  const isAdmin = group.admins.includes(currentUser?._id || '')

  // Check if user is owner of this group
  const isOwner = group.owner === currentUser?._id

  const handleJoinLeave = (action: 'join' | 'leave') => {
    setActionType(action)
    setConfirmDialogOpen(true)
  }

  const handleEdit = () => {
    routerPush(router, `/${locale}/groups/${group._id}`, {
      source: 'group_card_edit_button',
      groupId: group._id,
      groupName: group.name
    })
  }

  const handleViewParticipants = () => {
    routerPush(router, `/${locale}/users?groupId=${group._id}`, {
      source: 'group_card_participants_button',
      groupId: group._id,
      groupName: group.name
    })
  }

  const handleConfirm = async () => {
    if (!currentUser) return
    
    // Create a copy of the current groups list
    const updatedGroups = [...(currentUser.groups || [])]
    
    if (actionType === 'join') {
      // Add group
      if (!updatedGroups.includes(group._id)) {
        updatedGroups.push(group._id)
      }
    } else {
      // Remove group
      const index = updatedGroups.indexOf(group._id)
      if (index !== -1) {
        updatedGroups.splice(index, 1)
      }
    }
    
    // Update the user with the new groups list
    setCurrentUser({
      ...currentUser,
      groups: updatedGroups
    })
    
    await updateUserData()
    // Refetch groups to update participant counts and any other group data
    refetch()
    setConfirmDialogOpen(false)
  }

  const handleCancel = () => {
    setConfirmDialogOpen(false)
  }

  const handleGroupClick = () => {
    // In firstTime mode, clicking the card toggles the checkbox
    if (firstTime && onToggle) {
      onToggle(group._id);
      return;
    }

    // Otherwise, clicking the card does nothing
    // Use the "Participants" button to view group members
  }

  const { imageSrc } = useGroupImage(group._id)

  return (
    <>
      <div
        className={`rounded-lg p-5sp transition-colors ${firstTime ? 'cursor-pointer' : ''}`}
        onClick={handleGroupClick}
      >
        {firstTime && (
          <div className="flex justify-center mb-2">
            <Checkbox
              checked={checked}
              onChange={(e) => {
                e.stopPropagation()
                if (onToggle) {
                  onToggle(group._id)
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className="flex items-center gap-4 mb-2">
          <div className="relative w-12 h-12 flex-shrink-0 overflow-hidden rounded-full">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={group.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full" style={{ backgroundColor: 'var(--icon-color-primary)' }}>
                <GroupIcon className="text-white" />
              </div>
            )}
          </div>

          <div className="flex-grow">
            <div className="flex items-center gap-2">
              <Typography variant="h6" className="text-color font-medium">
                {group.name}
              </Typography>
              {!group.open && <span className="icon-gradient"><LockIcon fontSize="small" /></span>}
            </div>

            <Typography variant="body2" className="dimmer-text-color">
              {group.open ? t('openGroup') : t('privateGroup')} · {t('participantCount', { count: group.usersCount || 0 })}
            </Typography>
          </div>

          <div className="flex items-center space-x-2 ml-auto">
            {(isAdmin || isOwner) && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit()
                }}
                aria-label={t('editGroup')}
                title={t('editGroup')}
                className="icon-gradient"
              >
                <EditIcon />
              </IconButton>
            )}
          </div>
        </div>

        {group.description && (
          <div className="mb-4">
            <Typography variant="body2" className="dimmer-text-color">
              {group.description}
            </Typography>
          </div>
        )}

        {!firstTime && (group.language || isOwner || isAdmin) && (
          <div className="flex flex-wrap gap-1 items-center mb-2">
            {/* Language chip */}
            {group.language && (
              <Chip
                label={LANGUAGES.find(lang => lang.code === group.language)?.name || group.language}
                size="small"
                className="text-xs text-white bg-gray-700"
              />
            )}

            {/* Badge */}
            {isOwner ? (
              <Typography variant="caption" className="text-color px-2 py-0.5 rounded" style={{ border: '1px solid var(--icon-color-primary)' }}>
                {t('owner')}
              </Typography>
            ) : isAdmin && (
              <Typography variant="caption" className="text-color px-2 py-0.5 rounded" style={{ border: '1px solid var(--icon-color-primary)' }}>
                {t('admin')}
              </Typography>
            )}
          </div>
        )}

        {/* Participants and Join/Leave buttons on separate line */}
        {!firstTime && (
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<span className="icon-gradient"><PeopleIcon /></span>}
              onClick={(e) => {
                e.stopPropagation()
                handleViewParticipants()
              }}
              className="flex-shrink-0"
              sx={{ px: 2 }}
            >
              {t('participants')}
            </Button>
            {isInGroup && !isOwner ? (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<span className="icon-gradient"><ExitToAppIcon /></span>}
                onClick={(e) => {
                  e.stopPropagation()
                  handleJoinLeave('leave')
                }}
                disabled={updateLoading}
                className="flex-shrink-0"
              >
                {t('leave')}
              </Button>
            ) : !isInGroup && (
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<span className="icon-gradient"><AddIcon /></span>}
                onClick={(e) => {
                  e.stopPropagation()
                  handleJoinLeave('join')
                }}
                disabled={updateLoading || (!group.open && !isAdmin)}
                className="flex-shrink-0"
              >
                {t('join')}
              </Button>
            )}
          </div>
        )}
        {firstTime && group.language && (
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1 items-center">
              {/* Language chip */}
              <Chip
                label={LANGUAGES.find(lang => lang.code === group.language)?.name || group.language}
                size="small"
                className="text-xs text-white bg-gray-700"
              />
            </div>
          </div>
        )}
      </div>

      {/* Join/Leave Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={handleCancel}>
        <DialogTitle>
          {actionType === 'join' 
            ? t('join') + ` ${group.name}?`
            : t('leave') + ` ${group.name}?`
          }
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionType === 'join' 
              ? t('confirmJoinGroup')
              : t('confirmLeaveGroup')
            }
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>
            {t('no')}
          </Button>
          <Button 
            onClick={handleConfirm} 
            variant="contained" 
            color={actionType === 'join' ? 'primary' : 'error'}
            disabled={updateLoading}
          >
            {t('yes')}
          </Button>
        </DialogActions>
      </Dialog>

    </>
  )
} 