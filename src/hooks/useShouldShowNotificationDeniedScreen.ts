'use client'

import { useState, useEffect } from 'react'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

export function useShouldShowNotificationDeniedScreen() {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Notification) return

    // Check if notification permission is denied (not default, which means already asked)
    const isPermissionDenied = window.Notification.permission === 'denied'

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

    // Check if in PWA mode
    const standalone = ('standalone' in window.navigator) && (window.navigator as any).standalone
    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isPWA = standalone || displayModeStandalone

    // Show notification denied screen if:
    // 1. Permission is denied (user already declined)
    // 2. On mobile (iOS/Android), not desktop
    // 3. In PWA mode (since we only show this after PWA installation)
    setShouldShow(isPermissionDenied && platform !== 'desktop' && isPWA)
  }, [])

  return shouldShow
}

export function useShouldShowNotificationRequestScreen() {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Notification) return

    // Check if notification permission is default (not yet asked)
    const isPermissionDefault = window.Notification.permission === 'default'

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

    // Check if in PWA mode
    const standalone = ('standalone' in window.navigator) && (window.navigator as any).standalone
    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isPWA = standalone || displayModeStandalone

    // Show notification request screen if:
    // 1. Permission is default (not yet asked)
    // 2. On mobile (iOS/Android), not desktop
    // 3. In PWA mode
    setShouldShow(isPermissionDefault && platform !== 'desktop' && isPWA)
  }, [])

  return shouldShow
}
