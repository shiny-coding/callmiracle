'use client'

import React from 'react'
import { User } from '@/generated/graphql'

interface UserAvatarProps {
  user?: User | null
  userName?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4 text-xs',
  md: 'w-5 h-5 text-xs',
  lg: 'w-12 h-12 text-lg'
}

export default function UserAvatar({ 
  user, 
  userName, 
  size = 'md', 
  className = '' 
}: UserAvatarProps) {
  const sizeClass = sizeClasses[size]
  const displayName = userName || (user as any)?.name || 'U'
  const userId = (user as any)?._id

  return (
    <div className={`flex-shrink-0 ${sizeClass} ${className}`}>
      {userId ? (
        <img
          src={`/profiles/${userId}.jpg`}
          alt={displayName}
          className={`${sizeClass} rounded-full object-cover`}
          style={{ display: 'none' }}
          onLoad={(e) => {
            const target = e.target as HTMLImageElement
            // Check if it's not the default 1x1 transparent image
            if (target.naturalWidth > 1 && target.naturalHeight > 1) {
              target.style.display = 'block'
              const fallback = target.nextElementSibling as HTMLDivElement
              if (fallback) {
                fallback.style.display = 'none'
              }
            }
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLDivElement
            if (fallback) {
              fallback.style.display = 'flex'
            }
          }}
        />
      ) : null}
      <div 
        className={`${sizeClass} py-1 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold`}
        style={{ display: 'flex' }}
      >
        {displayName[0]?.toUpperCase()}
      </div>
    </div>
  )
} 