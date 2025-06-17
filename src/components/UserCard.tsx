import { Typography, Chip, IconButton, Avatar, Button } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import { LANGUAGES } from '@/config/languages'
import CallIcon from '@mui/icons-material/Call'
import HistoryIcon from '@mui/icons-material/History'
import LockIcon from '@mui/icons-material/Lock'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import CheckIcon from '@mui/icons-material/Check'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useDetailedCallHistory } from '@/store/DetailedCallHistoryProvider'
import { useState } from 'react'
import UserDetailsPopup from './UserDetailsPopup'
import { useStore } from '@/store/useStore'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { useCheckImage } from '@/hooks/useCheckImage'

interface UserCardProps {
  user: User
  showDetails?: boolean
  showCallButton?: boolean
  showHistoryButton?: boolean
}

export default function UserCard({ 
  user, 
  showDetails = true, 
  showCallButton = false,
  showHistoryButton = false,
}: UserCardProps) {
  const t = useTranslations()
  const { doCall } = useWebRTCContext()
  const { setSelectedUser } = useDetailedCallHistory()
  const [detailsPopupOpen, setDetailsPopupOpen] = useState(false)
  const { currentUser, setCurrentUser } = useStore( (state: any) => ({
    currentUser: state.currentUser,
    setCurrentUser: state.setCurrentUser
  }))
  const { updateUserData, loading: updateLoading } = useUpdateUser()
  const { exists: imageExists } = useCheckImage(user._id)
  
  const existingBlock = currentUser?.blocks.find((b:any) => b.userId === user._id)
  const isBlocked = existingBlock?.all || (existingBlock?.interests.length ?? 0) > 0
  
  // Check if this user is a friend
  const isFriend = currentUser?.friends?.includes(user._id) || false
  
  // Check if this is the current user
  const isCurrentUser = currentUser?._id === user._id

  const handleCall = async () => {
    await doCall(user, false, null, null)
  }

  const handleFriendToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    
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
  }

  return (
    <>
      <div 
        className="flex items-center gap-4 mb-4 cursor-pointer"
        onClick={() => setDetailsPopupOpen(true)}
      >
        <div className="relative">
          <Avatar
            src={imageExists ? `/profiles/${user._id}.jpg` : undefined}
            className="w-12 h-12"
          >
            {!imageExists && user.name?.[0]?.toUpperCase()}
          </Avatar>
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
        <div className="flex gap-2">
          {showHistoryButton && !isCurrentUser && (
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                setSelectedUser(user)
              }}
              className="text-white hover:bg-gray-600"
            >
              <HistoryIcon />
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
        </div>
      </div>

      {showDetails && user.languages.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {user.languages.map(lang => {
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
      )}

      {isBlocked && (
        <LockIcon 
          className="text-red-500 absolute bottom-7 right-7" 
          fontSize="small"
          titleAccess={existingBlock?.all ? t('userBlocked') : t('someInterestsBlocked')}
        />
      )}

      {currentUser?._id && currentUser?._id !== user._id && (
        <Button
          variant={isFriend ? "outlined" : "contained"}
          color={isFriend ? "success" : "primary"}
          size="small"
          startIcon={isFriend ? <CheckIcon /> : <PersonAddIcon />}
          onClick={handleFriendToggle}
          disabled={updateLoading}
          className="mr-2"
        >
          {isFriend ? t('friend') : t('addFriend')}
        </Button>
      )}

      {isCurrentUser && (
        <Button
          variant="outlined"
          color="primary"
          size="small"
          disabled
          className="mr-2"
        >
          {t('me')}
        </Button>
      )}

      <UserDetailsPopup
        user={user}
        open={detailsPopupOpen}
        onClose={() => setDetailsPopupOpen(false)}
      />
    </>
  )
} 