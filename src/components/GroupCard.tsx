import { Typography, Button, Paper, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material'
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
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<'join' | 'leave'>('join')
  const router = useRouter()
  const locale = useLocale()
  
  // Check if user is already in this group
  const isInGroup = currentUser?.groups?.includes(group._id) || false
  
  // Check if user is admin of this group
  const isAdmin = group.admins.includes(currentUser?._id || '')

  const handleJoinLeave = (action: 'join' | 'leave') => {
    setActionType(action)
    setConfirmDialogOpen(true)
  }

  const handleEdit = () => {
    router.push(`/${locale}/groups/${group._id}`)
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
      <Paper className="p-4 mb-3 bg-gray-800 hover:bg-gray-700 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-grow">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full">
              <GroupIcon className="text-white" />
            </div>
            
            <div className="flex-grow">
              <div className="flex items-center gap-2">
                <Typography variant="h6" className="text-white font-medium">
                  {group.name}
                </Typography>
                {!group.open && <LockIcon className="text-gray-400" fontSize="small" />}
                {isAdmin && (
                  <Typography variant="caption" className="text-blue-400 bg-blue-900 px-2 py-1 rounded">
                    Admin
                  </Typography>
                )}
              </div>
              
              <Typography variant="body2" className="text-gray-400">
                {group.open ? 'Open Group' : 'Private Group'}
              </Typography>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {isAdmin && (
              <IconButton
                size="small"
                onClick={handleEdit}
                aria-label={t('editGroup', { defaultValue: 'Edit Group' })}
                title={t('editGroup', { defaultValue: 'Edit Group' })}
              >
                <EditIcon className="text-gray-400 hover:text-white" />
              </IconButton>
            )}
            {isInGroup ? (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<ExitToAppIcon />}
                onClick={() => handleJoinLeave('leave')}
                disabled={updateLoading}
              >
                {t('leave', { defaultValue: 'Leave' })}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => handleJoinLeave('join')}
                disabled={updateLoading || (!group.open && !isAdmin)}
              >
                {t('join', { defaultValue: 'Join' })}
              </Button>
            )}
          </div>
        </div>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={handleCancel}>
        <DialogTitle>
          {actionType === 'join' 
            ? `Join ${group.name}?` 
            : `Leave ${group.name}?`
          }
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionType === 'join' 
              ? `Are you sure you want to join the group "${group.name}"?`
              : `Are you sure you want to leave the group "${group.name}"?`
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