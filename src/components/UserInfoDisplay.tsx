import { Typography, Chip, IconButton, Avatar } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import { LANGUAGES } from '@/config/languages'
import Image from 'next/image'
import CallIcon from '@mui/icons-material/Call'
import HistoryIcon from '@mui/icons-material/History'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useDetailedCallHistory } from '@/store/DetailedCallHistoryProvider'
import { useState } from 'react'
import UserDetailsPopup from './UserDetailsPopup'

interface UserInfoDisplayProps {
  user: User
  showDetails?: boolean
  showCallButton?: boolean
  showHistoryButton?: boolean
}

export default function UserInfoDisplay({ 
  user, 
  showDetails = true, 
  showCallButton = false,
  showHistoryButton = false 
}: UserInfoDisplayProps) {
  const t = useTranslations()
  const tStatus = useTranslations('Status')
  const { doCall } = useWebRTCContext()
  const { setSelectedUser } = useDetailedCallHistory()
  const [detailsPopupOpen, setDetailsPopupOpen] = useState(false)

  const handleCall = async () => {
    await doCall(user)
  }

  return (
    <>
      <div 
        className="flex items-center gap-4 mb-4 cursor-pointer"
        onClick={() => setDetailsPopupOpen(true)}
      >
        <div className="relative">
          <Avatar
            src={user.hasImage ? `/profiles/${user.userId}.jpg` : undefined}
            className={`
              w-12 h-12
            `}
          >
            {!user.hasImage && user.name?.[0]?.toUpperCase()}
          </Avatar>
          {user.online && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
          )}
        </div>
        <div className="flex-grow">
          <Typography variant="h6" className="text-white">
            {user.name}
          </Typography>
        </div>
        <div className="flex gap-2">
          {showHistoryButton && (
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
          {showCallButton && (
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

      {showDetails && user.statuses.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-1">
            {user.statuses.map(status => (
              <Chip
                key={status}
                label={tStatus(status)}
                size="small"
                className="text-xs text-white bg-gray-700"
              />
            ))}
          </div>
        </div>
      )}

      <UserDetailsPopup
        user={user}
        open={detailsPopupOpen}
        onClose={() => setDetailsPopupOpen(false)}
      />
    </>
  )
} 