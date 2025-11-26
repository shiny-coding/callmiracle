'use client'

import { Typography, Chip, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User, Group } from '@/generated/graphql'
import { LANGUAGES } from '@/config/languages'
import CallIcon from '@mui/icons-material/Call'
import LockIcon from '@mui/icons-material/Lock'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle'
import MessageIcon from '@mui/icons-material/Message'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useState } from 'react'
import UserDetailsPopup from './UserDetailsPopup'
import { useStore } from '@/store/useStore'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useRemoveUserFromGroup } from '@/hooks/useRemoveUserFromGroup'
import { useSnackbar } from '@/contexts/SnackContext'
import UserAvatar from './UserAvatar'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { routerPush } from '@/utils/routerHelper'

interface UserCardProps {
  user: User
  showDetails?: boolean
  showCallButton?: boolean
  showMessageButton?: boolean
  filteringByGroup?: Group | null // The group being filtered by, if any
}

export default function UserCard({
  user,
  showDetails = true,
  showCallButton = false,
  showMessageButton = false,
  filteringByGroup = null
}: UserCardProps) {
  const t = useTranslations()
  const { doCall } = useWebRTCContext()
  const router = useRouter()
  const locale = useLocale()
  const [detailsPopupOpen, setDetailsPopupOpen] = useState(false)
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [friendConfirmOpen, setFriendConfirmOpen] = useState(false)
  const { currentUser, setCurrentUser } = useStore( (state: any) => ({
    currentUser: state.currentUser,
    setCurrentUser: state.setCurrentUser
  }))
  const { updateUserData, loading: updateLoading } = useUpdateUser()
  const { removeUserFromGroup, loading: removeLoading } = useRemoveUserFromGroup()
  const { showSnackbar } = useSnackbar()
  
  const existingBlock = currentUser?.blocks.find((b:any) => b.userId === user._id)
  const isBlocked = existingBlock?.all || (existingBlock?.interestsBlocks?.length ?? 0) > 0
  
  // Check if this user is a friend
  const isFriend = currentUser?.friends?.includes(user._id) || false
  
  // Check if this is the current user
  const isCurrentUser = currentUser?._id === user._id

  // Check if current user can remove others from the group
  const canRemoveFromGroup = filteringByGroup && !isCurrentUser && (
    filteringByGroup.owner === currentUser?._id || 
    filteringByGroup.admins.includes(currentUser?._id || '')
  )

  // Prevent removing the group owner
  const isGroupOwner = filteringByGroup?.owner === user._id

  const handleCall = async () => {
    await doCall(user, null, null)
  }

  const handleFriendButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFriendConfirmOpen(true)
  }

  const handleFriendToggle = () => {
    if (!currentUser) return

    // Create a copy of the current friends list
    const updatedFriends = [...(currentUser.friends || [])]

    if (isFriend) {
      // Remove friend
      const index = updatedFriends.indexOf(user._id)
      if (index !== -1) {
        updatedFriends.splice(index, 1)
      }
    } else {
      // Add friend
      updatedFriends.push(user._id)
    }
    // Update the user with the new friends list
    setCurrentUser({
      ...currentUser,
      friends: updatedFriends
    })
    updateUserData()
    setFriendConfirmOpen(false)
  }

  const handleRemoveFromGroup = async () => {
    if (!filteringByGroup) return
    
    try {
      await removeUserFromGroup(filteringByGroup._id, user._id)
      showSnackbar(t('userRemovedFromGroup'), 'success')
      setRemoveConfirmOpen(false)
    } catch (error) {
      console.error('Error removing user from group:', error)
      showSnackbar(t('errorRemovingUserFromGroup'), 'error')
    }
  }

  return (
    <>
      <div className="p-5sp relative">
        <div
          className="flex items-center gap-4 mb-4 cursor-pointer"
          onClick={() => setDetailsPopupOpen(true)}
        >
          <div className="relative">
            <UserAvatar
              user={user}
              userName={user.name}
              size="lg"
            />
          </div>
          <div className="flex-grow">
            <Typography variant="h6" className="text-white">
              {user.name}
            </Typography>

            {user.about && (
              <Typography variant="body2" className="text-gray-300 mt-1">
                {user.about}
              </Typography>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {canRemoveFromGroup && !isGroupOwner && (
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  setRemoveConfirmOpen(true)
                }}
                className="text-red-400 hover:bg-red-900"
                title={t('removeFromGroup')}
              >
                <RemoveCircleIcon />
              </IconButton>
            )}
          </div>
        </div>

        {showDetails && (() => {
          // Show only languages that both the current user and this user speak
          const myLanguages = currentUser?.languages || []
          const sharedLanguages = user.languages.filter(lang => myLanguages.includes(lang))
          // Don't show language badges if current user speaks only one language
          if (myLanguages.length <= 1 || sharedLanguages.length === 0) return null
          return (
            <div className="mb-4">
              <div className="flex flex-wrap gap-1">
                {sharedLanguages.map(lang => {
                  const language = LANGUAGES.find(l => l.code === lang)
                  return (
                    <Chip
                      key={lang}
                      label={language?.name || lang}
                      size="small"
                      className="text-xs text-white bg-gray-700"
                    />
                  )
                })}
              </div>
            </div>
          )
        })()}

        {isBlocked && (
          <LockIcon
            className="text-red-500 absolute bottom-7 right-7"
            fontSize="small"
            titleAccess={existingBlock?.all ? t('userBlocked') : t('someInterestsBlocked')}
          />
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {/* Action buttons */}
          <div className="flex gap-2 items-center">
            {/* Me badge or Friend/Add Friend button */}
            {isCurrentUser && (
              <Chip
                label={t('me')}
                size="small"
                className="bg-green-600 text-white text-xs"
              />
            )}
            {currentUser?._id && !isCurrentUser && (
              <IconButton
                onClick={handleFriendButtonClick}
                disabled={updateLoading}
                className={isFriend ? "text-green-500 hover:bg-green-900" : "text-blue-400 hover:bg-blue-900"}
                title={isFriend ? t('friend') : t('addFriend')}
              >
                {isFriend ? <HowToRegIcon /> : <PersonAddIcon />}
              </IconButton>
            )}
            {showMessageButton && !isCurrentUser && (
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  routerPush(router, `/${locale}/conversations?with=${user._id}`, {
                    source: 'user_card_message_button',
                    targetUserId: user._id,
                    targetUserName: user.name
                  })
                }}
                className="text-white hover:bg-gray-600"
                title={t('sendMessage')}
              >
                <MessageIcon />
              </IconButton>
            )}
            {showCallButton && !isCurrentUser && (
              <IconButton
                onClick={(e) => {
                  e.stopPropagation()
                  handleCall()
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <CallIcon className="text-white" />
              </IconButton>
            )}
            {/* Spacer for current user's card to maintain consistent height */}
            {isCurrentUser && (showMessageButton || showCallButton) && (
              <div className="h-10" />
            )}
          </div>
        </div>
      </div>

      <UserDetailsPopup
        user={user}
        open={detailsPopupOpen}
        onClose={() => setDetailsPopupOpen(false)}
      />

      {/* Remove from group confirmation dialog */}
      <Dialog
        open={removeConfirmOpen}
        onClose={() => setRemoveConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('removeFromGroup')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('confirmRemoveFromGroup', { userName: user.name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRemoveConfirmOpen(false)}
            disabled={removeLoading}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleRemoveFromGroup}
            color="error"
            variant="contained"
            disabled={removeLoading}
          >
            {t('removeFromGroup')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add/Remove friend confirmation dialog */}
      <Dialog
        open={friendConfirmOpen}
        onClose={() => setFriendConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{isFriend ? t('removeFriend') : t('addFriend')}</DialogTitle>
        <DialogContent>
          <Typography>
            {isFriend
              ? t('confirmRemoveFriend', { userName: user.name })
              : t('confirmAddFriend', { userName: user.name })
            }
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setFriendConfirmOpen(false)}
            disabled={updateLoading}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleFriendToggle}
            color={isFriend ? "error" : "primary"}
            variant="contained"
            disabled={updateLoading}
          >
            {isFriend ? t('removeFriend') : t('addFriend')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
} 