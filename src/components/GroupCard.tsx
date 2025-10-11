'use client'

import { Typography, Button, Paper, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Group } from '@/generated/graphql'
import GroupIcon from '@mui/icons-material/Group'
import LockIcon from '@mui/icons-material/Lock'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
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
}

export default function GroupCard({ group }: GroupCardProps) {
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
    routerPush(router, `/${locale}/users?groupId=${group._id}`, {
      source: 'group_card_click',
      groupId: group._id,
      groupName: group.name
    })
  }

  const { imageSrc } = useGroupImage(group._id)

  return (
    <>
      <div
        className="cursor-pointer rounded-lg p-2 transition-colors"
        onClick={handleGroupClick}
      >
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
              <div className="flex items-center justify-center w-full h-full bg-blue-600">
                <GroupIcon className="text-white" />
              </div>
            )}
          </div>

          <div className="flex-grow">
            <div className="flex items-center gap-2">
              <Typography variant="h6" className="text-white font-medium">
                {group.name}
              </Typography>
              {!group.open && <LockIcon className="text-gray-400" fontSize="small" />}
            </div>

            <Typography variant="body2" className="text-gray-400">
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
              >
                <EditIcon className="text-gray-400 hover:text-white" />
              </IconButton>
            )}
          </div>
        </div>

        {group.description && (
          <div className="mb-4">
            <Typography variant="body2" className="text-gray-300">
              {group.description}
            </Typography>
          </div>
        )}

        {((isOwner || isAdmin) || group.language || (isInGroup && !isOwner) || !isInGroup) && (
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1 items-center">
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
                <Typography variant="caption" className="text-green-400 bg-green-900 px-2 py-1 rounded">
                  {t('owner')}
                </Typography>
              ) : isAdmin && (
                <Typography variant="caption" className="text-blue-400 bg-blue-900 px-2 py-1 rounded">
                  {t('admin')}
                </Typography>
              )}
            </div>
            {isInGroup && !isOwner ? (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<ExitToAppIcon />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleJoinLeave('leave')
                }}
                disabled={updateLoading}
              >
                {t('leave')}
              </Button>
            ) : !isInGroup && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<AddIcon />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleJoinLeave('join')
                }}
                disabled={updateLoading || (!group.open && !isAdmin)}
              >
                {t('join')}
              </Button>
            )}
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