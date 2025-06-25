import { Badge } from '@mui/material'
import React from 'react'

interface NotificationBadgeProps {
  show: boolean
  children: React.ReactNode
}

export default function NotificationBadge({ show, children }: NotificationBadgeProps) {
  return (
    <Badge color="error" variant="dot" invisible={!show}>
      {children}
    </Badge>
  )
} 