'use client'

import { useEffect } from 'react'

export default function ViewportHeightSetter() {
  useEffect(() => {
    function updateViewport() {
      // Use visualViewport for better iOS support, fallback to window.innerHeight
      const viewport = window.visualViewport
      const height = viewport?.height || window.innerHeight
      document.documentElement.style.setProperty('--vh', `${height * 0.01}px`)

      // On iOS, when keyboard opens, the visualViewport has an offsetTop
      // We need to account for this to position content correctly
      if (viewport) {
        document.documentElement.style.setProperty('--viewport-offset-top', `${viewport.offsetTop}px`)
      }
    }

    // Set initial value
    updateViewport()

    // Handle resize events
    window.addEventListener('resize', updateViewport)

    // Handle orientation changes (important for iOS)
    window.addEventListener('orientationchange', () => {
      // Add a small delay to allow the browser to recalculate dimensions
      setTimeout(updateViewport, 100)
    })

    // Also listen to visualViewport resize and scroll if available (better for iOS)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewport)
      window.visualViewport.addEventListener('scroll', updateViewport)
    }

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewport)
        window.visualViewport.removeEventListener('scroll', updateViewport)
      }
    }
  }, [])

  return null
} 