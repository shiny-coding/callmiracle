import { Typography, Chip, IconButton } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import { LANGUAGES } from '@/config/languages'
import Image from 'next/image'
import CallIcon from '@mui/icons-material/Call'
import HistoryIcon from '@mui/icons-material/History'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useDetailedCallHistory } from '@/store/DetailedCallHistoryProvider'

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

  const handleCall = async () => {
    await doCall(user)
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16">
          <div className="rounded-full overflow-hidden bg-gray-800 w-full h-full">
            {user.hasImage ? (
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <Image
                  src={`/profiles/${user.userId}.jpg?t=${user.timestamp}`}
                  alt={user.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-white">
                {user.name[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            user.online ? 'bg-green-500' : 'bg-red-500'
          }`} />
        </div>
        <div className="flex-grow">
          <Typography variant="h6" className="text-white">
            {user.name}
          </Typography>
        </div>
        <div className="flex gap-2">
          {showHistoryButton && (
            <IconButton
              onClick={() => setSelectedUser(user)}
              className="text-white hover:bg-gray-600"
            >
              <HistoryIcon />
            </IconButton>
          )}
          {showCallButton && (
            <IconButton 
              onClick={handleCall}
              className="bg-green-600 hover:bg-green-700"
            >
              <CallIcon className="text-white" />
            </IconButton>
          )}
        </div>
      </div>

      {showDetails && user.languages.length > 0 && (
        <div className="mb-4">
          <Typography variant="subtitle2" className="mb-2 text-gray-400">
            {t('languages')}
          </Typography>
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
          <Typography variant="subtitle2" className="mb-2 text-gray-400">
            {t('status')}
          </Typography>
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
    </>
  )
} 