import React, { useState, useEffect } from 'react'
import { Typography } from '@mui/material'
import { COMPACT_LAYOUT_HEIGHT_THRESHOLD } from '@/constants/layout'

interface PageHeaderProps {
  icon?: React.ReactNode
  title: string
  children?: React.ReactNode // For action buttons on the right
  className?: string
}

export default function PageHeader({ icon, title, children, className }: PageHeaderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const checkCollapse = () => {
      setIsCollapsed(window.innerHeight < COMPACT_LAYOUT_HEIGHT_THRESHOLD)
    }

    checkCollapse()
    window.addEventListener('resize', checkCollapse)
    return () => window.removeEventListener('resize', checkCollapse)
  }, [])

  if (isCollapsed) {
    return null
  }

  return (
    <div
      className={`flex items-center px-4 py-3 ${className || ''}`}
      style={{ borderBottom: '1px solid var(--border-color)' }} // Consistent border
    >
      {icon && <div className="mr-2">{icon}</div>}
      <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
        {title}
      </Typography>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
} 