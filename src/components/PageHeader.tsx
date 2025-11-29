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
      // Use visualViewport for better iOS support, fallback to window.innerHeight
      const height = window.visualViewport?.height || window.innerHeight
      setIsCollapsed(height < COMPACT_LAYOUT_HEIGHT_THRESHOLD)
    }

    // Set initial value
    checkCollapse()

    // Handle resize events
    window.addEventListener('resize', checkCollapse)

    // Handle orientation changes (important for iOS)
    window.addEventListener('orientationchange', () => {
      // Add a small delay to allow the browser to recalculate dimensions
      setTimeout(checkCollapse, 100)
    })

    // Also listen to visualViewport resize if available (better for iOS)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkCollapse)
    }

    return () => {
      window.removeEventListener('resize', checkCollapse)
      window.removeEventListener('orientationchange', checkCollapse)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', checkCollapse)
      }
    }
  }, [])

  if (isCollapsed) {
    return null
  }

  return (
    <div
      className={`flex items-center px-4 py-2 ${className || ''}`}
    >
      {icon && <div className="mr-2 title-bar-icon">{icon}</div>}
      <Typography variant="h6" component="div" className="dimmer-text-color page-title" sx={{ flexGrow: 1 }}>
        {title}
      </Typography>
      {children && <div className="flex items-center gap-2 icon-gradient">{children}</div>}
    </div>
  )
} 