import { Typography, Chip } from '@mui/material'
import { useTranslations } from 'next-intl'
import { User } from '@/generated/graphql'
import { LANGUAGES } from '@/config/languages'
import Image from 'next/image'

interface UserInfoDisplayProps {
  user: User
}

export default function UserInfoDisplay({ user }: UserInfoDisplayProps) {
  const t = useTranslations()
  const tStatus = useTranslations('Status')

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16">
          <div className="rounded-full pl-1 pt-1 overflow-hidden bg-gray-800 w-full h-full">
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
        <div>
          <Typography variant="h6" className="text-white">
            {user.name}
          </Typography>
        </div>
      </div>

      {user.languages.length > 0 && (
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

      {user.statuses.length > 0 && (
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