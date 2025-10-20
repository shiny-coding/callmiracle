import { Badge } from '@mui/material'
import React from 'react'

interface NotificationBadgeProps {
  show: boolean
  children: React.ReactNode
  color?: 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary'
}

export default function NotificationBadge({ show, children, color = 'success' }: NotificationBadgeProps) {
  return (
    <Badge
      color={color}
      variant="dot"
      invisible={!show}
      sx={{
        '& .MuiBadge-dot': {
          right: -2,
        }
      }}
    >
      {children}
    </Badge>
  )
} 