'use client'

import { Typography, Chip } from '@mui/material'
import { User } from '@/generated/graphql'
import { LANGUAGES } from '@/config/languages'
import UserAvatar from './UserAvatar'

interface CallUserInfoProps {
  user: User
  compact?: boolean
}

export default function CallUserInfo({ user, compact = false }: CallUserInfoProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-center gap-3 py-2">
        <UserAvatar
          user={user}
          userName={user.name}
          size="lg"
        />
        <Typography variant="h6" className="text-color">
          {user.name}
        </Typography>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Avatar */}
      <UserAvatar
        user={user}
        userName={user.name}
        size="lg"
      />

      {/* Name */}
      <Typography variant="h6" className="text-color text-center">
        {user.name}
      </Typography>

      {/* Languages */}
      {user.languages.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
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
      )}
    </div>
  )
}
