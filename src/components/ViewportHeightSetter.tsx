'use client'

import { useEffect } from 'react'

export default function ViewportHeightSetter() {
  useEffect(() => {
    function setVh() {
      // Use visualViewport for better iOS support, fallback to window.innerHeight
      const height = window.visualViewport?.height || window.innerHeight
      document.documentElement.style.setProperty('--vh', `${height * 0.01}px`)
    }

    // Set initial value
    setVh()

    // Handle resize events
    window.addEventListener('resize', setVh)

    // Handle orientation changes (important for iOS)
    window.addEventListener('orientationchange', () => {
      // Add a small delay to allow the browser to recalculate dimensions
      setTimeout(setVh, 100)
    })

    // Also listen to visualViewport resize if available (better for iOS)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setVh)
    }

    return () => {
      window.removeEventListener('resize', setVh)
      window.removeEventListener('orientationchange', setVh)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', setVh)
      }
    }
  }, [])

  return null
} 