'use client'

import { useState, useEffect } from 'react'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

export function useShouldShowPWAScreen() {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Detect if in standalone mode (PWA)
    const standalone = ('standalone' in window.navigator) && (window.navigator as any).standalone
    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isPWA = standalone || displayModeStandalone

    // Detect platform
    const userAgent = navigator.userAgent
    let platform: Platform = 'unknown'
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      platform = 'ios'
    } else if (/Android/.test(userAgent)) {
      platform = 'android'
    } else {
      platform = 'desktop'
    }

    // Show PWA screen if not in PWA mode and on mobile (iOS/Android)
    setShouldShow(!isPWA && platform !== 'desktop')
  }, [])

  return shouldShow
}
