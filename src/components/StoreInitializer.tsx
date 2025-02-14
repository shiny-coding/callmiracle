'use client'

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

export function StoreInitializer() {
  
  useEffect(() => {
    // Handle store hydration
    useStore.persist.rehydrate()
  }, [])

  return null // This is a utility component, it doesn't render anything
} 