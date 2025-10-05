'use client'

import { ReactNode, useState, useEffect } from 'react'
import LoadingDialog from './LoadingDialog'

interface DeferredRenderProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Wrapper component that defers rendering of heavy components to prevent UI freezing.
 * Shows a loader while scheduling the actual content rendering for the next idle frame.
 */
export default function DeferredRender({ children, fallback }: DeferredRenderProps) {
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    // Use requestIdleCallback if available, otherwise requestAnimationFrame
    const scheduleRender = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => setShowContent(true), { timeout: 100 })
      } else {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setShowContent(true))
        })
      }
    }
    scheduleRender()
  }, [])

  if (!showContent) {
    return <>{fallback || <LoadingDialog loading={true} error={null} />}</>
  }

  return <>{children}</>
}
