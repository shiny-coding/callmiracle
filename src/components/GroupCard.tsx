import { Typography, Button, Paper, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import { Group } from '@/generated/graphql'
import GroupIcon from '@mui/icons-material/Group'
import LockIcon from '@mui/icons-material/Lock'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useUpdateGroup } from '@/hooks/useUpdateGroup'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useSnackbar } from '@/contexts/SnackContext'
import { useGroups } from '@/store/GroupsProvider'
import ConfirmationDialog from './ConfirmationDialog'

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
  const { deleteGroup, loading: deleteLoading } = useUpdateGroup()
  const { refetch } = useGroups()
  const { showSnackbar } = useSnackbar()
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
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
    router.push(`/${locale}/groups/${group._id}`)
  }

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      await deleteGroup(group._id)
      
      // Remove the group from current user's groups if they were in it
      if (currentUser && isInGroup) {
        const updatedGroups = currentUser.groups?.filter((id: string) => id !== group._id) || []
        setCurrentUser({
          ...currentUser,
          groups: updatedGroups
        })
        await updateUserData()
      }
      
      refetch()
      showSnackbar(t('groupDeleted'), 'success')
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error('Error deleting group:', error)
      showSnackbar(t('errorDeletingGroup'), 'error')
    }
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
    setConfirmDialogOpen(false)
  }

  const handleCancel = () => {
    setConfirmDialogOpen(false)
  }

  return (
    <>
      <div className="flex items-center flex-grow flex-wrap"  style={{ gap: 'var(--20sp)' }}>
        <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full">
          <GroupIcon className="text-white" />
        </div>
        
        <div className="flex-grow">
          <div className="flex items-center" style={{ gap: 'var(--16sp)' }}>
            <Typography variant="h6" className="text-white font-medium">
              {group.name}
            </Typography>
            {!group.open && <LockIcon className="text-gray-400" fontSize="small" />}
            {isAdmin && (
              <Typography variant="caption" className="text-blue-400 bg-blue-900 px-2 py-1 rounded">
                {t('admin')}
              </Typography>
            )}
            {isOwner && (
              <Typography variant="caption" className="text-green-400 bg-green-900 px-2 py-1 rounded">
                {t('owner')}
              </Typography>
            )}
          </div>
          
          <Typography variant="body2" className="text-gray-400">
            {group.open ? t('openGroup') : t('privateGroup')}
          </Typography>
          
          <Typography variant="body2" className="text-gray-500 text-sm">
            {t('participantCount', { count: group.usersCount || 0 })}
          </Typography>
        </div>
        <div className="flex items-center space-x-2 ml-auto">
          {(isAdmin || isOwner) && (
            <IconButton
              size="small"
              onClick={handleEdit}
              aria-label={t('editGroup')}
              title={t('editGroup')}
            >
              <EditIcon className="text-gray-400 hover:text-white" />
            </IconButton>
          )}
          {isOwner && (
            <IconButton
              size="small"
              onClick={handleDeleteClick}
              aria-label={t('deleteGroup')}
              title={t('deleteGroup')}
            >
              <DeleteIcon className="text-red-400 hover:text-red-300" />
            </IconButton>
          )}
          {isInGroup ? (
            !isOwner && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<ExitToAppIcon />}
                onClick={() => handleJoinLeave('leave')}
                disabled={updateLoading}
              >
                {t('leave')}
              </Button>
            )
          ) : (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleJoinLeave('join')}
              disabled={updateLoading || (!group.open && !isAdmin)}
            >
              {t('join')}
            </Button>
          )}
        </div>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        title={t('deleteGroup')}
        message={t('confirmDeleteGroup', { groupName: group.name })}
        confirmText={t('delete')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleteLoading}
        destructive={true}
      />
    </>
  )
} 