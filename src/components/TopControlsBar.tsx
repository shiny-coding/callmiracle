'use client'

import { useState, useEffect } from 'react'
import { COMPACT_LAYOUT_HEIGHT_THRESHOLD } from '@/constants/layout'
import ControlsBar from './ControlsBar'

export default function TopControlsBar() {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const checkCompact = () => {
      setIsCompact(window.innerHeight < COMPACT_LAYOUT_HEIGHT_THRESHOLD)
    }

    checkCompact()
    window.addEventListener('resize', checkCompact)
    return () => window.removeEventListener('resize', checkCompact)
  }, [])

  if (isCompact) {
    return null
  }

  return <ControlsBar position="top" isCompact={isCompact} />
} 