'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSnackbar } from '@/contexts/SnackContext'
import { useTranslations } from 'next-intl'

type MessageType = 'success' | 'error' | 'info' | 'warning'

export function InitialMessageHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { showSnackbar } = useSnackbar()
  const t = useTranslations()
  const [hasShownMessage, setHasShownMessage] = useState(false)

  useEffect(() => {
    const messageKey = searchParams.get('messageKey')
    const messageType = searchParams.get('messageType') as MessageType | null
    
    if (messageKey && messageType && !hasShownMessage) {
      // Wait a bit for the app to initialize, then show the message
      const timer = setTimeout(() => {
        // Collect all additional parameters for message interpolation
        const messageParams: Record<string, string> = {}
        searchParams.forEach((value, key) => {
          if (key !== 'messageKey' && key !== 'messageType') {
            messageParams[key] = decodeURIComponent(value)
          }
        })

        // Show the message with proper type and interpolation
        const message = Object.keys(messageParams).length > 0 
          ? t(messageKey, messageParams)
          : t(messageKey)
        
        showSnackbar(message, messageType)
        setHasShownMessage(true)
        
        // Clean up URL by removing all message-related parameters
        const newSearchParams = new URLSearchParams(searchParams.toString())
        newSearchParams.delete('messageKey')
        newSearchParams.delete('messageType')
        Object.keys(messageParams).forEach(key => {
          newSearchParams.delete(key)
        })
        
        const newUrl = newSearchParams.toString()
        const currentPath = window.location.pathname
        router.replace(newUrl ? `${currentPath}?${newUrl}` : currentPath, { scroll: false })
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [searchParams, router, showSnackbar, t, hasShownMessage])

  return null
} 