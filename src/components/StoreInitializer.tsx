'use client'

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

export function StoreInitializer() {
  const initBrowserLangs = useStore(state => state.initBrowserLangs)
  
  useEffect(() => {
    // Handle store hydration
    useStore.persist.rehydrate()
    // Initialize any browser-dependent state
    initBrowserLangs()
  }, [initBrowserLangs])

  return null // This is a utility component, it doesn't render anything
} 