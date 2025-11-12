'use client'

import { useState, useEffect } from 'react'
import { COMPACT_LAYOUT_HEIGHT_THRESHOLD } from '@/constants/layout'
import ControlsBar from './ControlsBar'

export default function TopControlsBar() {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const checkCompact = () => {
      // Use visualViewport for better iOS support, fallback to window.innerHeight
      const height = window.visualViewport?.height || window.innerHeight
      setIsCompact(height < COMPACT_LAYOUT_HEIGHT_THRESHOLD)
    }

    // Set initial value
    checkCompact()

    // Handle resize events
    window.addEventListener('resize', checkCompact)

    // Handle orientation changes (important for iOS)
    window.addEventListener('orientationchange', () => {
      // Add a small delay to allow the browser to recalculate dimensions
      setTimeout(checkCompact, 100)
    })

    // Also listen to visualViewport resize if available (better for iOS)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkCompact)
    }

    return () => {
      window.removeEventListener('resize', checkCompact)
      window.removeEventListener('orientationchange', checkCompact)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', checkCompact)
      }
    }
  }, [])

  if (isCompact) {
    return <div style={{ height: '8px', flexShrink: 0 }} />
  }

  return <ControlsBar position="top" isCompact={isCompact} />
} 