'use client'

import { ReactNode, useState } from 'react'
import { useInitUser } from '@/hooks/useInitUser'
import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { UsersProvider } from '@/store/UsersProvider'
import { SubscriptionsProvider } from '@/contexts/SubscriptionsContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import { MeetingsProvider } from '@/contexts/MeetingsContext'
import LoadingDialog from './LoadingDialog'

interface AppContentProps {
  children: ReactNode
}

export function AppContent({ children }: AppContentProps) {
  const { loading, error } = useInitUser()
  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  return (
    <SubscriptionsProvider>
      <MeetingsProvider>
        <UsersProvider>
          <NotificationsProvider>
            {children}
          </NotificationsProvider>
        </UsersProvider>
      </MeetingsProvider>
    </SubscriptionsProvider>
  )
} 

export function StoreInitializer({ children }: AppContentProps) {
  
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const isHydrated = useStore.persist.hasHydrated()
    setIsHydrated(isHydrated)
    if (!isHydrated) {
      const unsub = useStore.persist.onFinishHydration(() => {
        setIsHydrated(true)
      })
      
      return unsub
    }
  }, [])

  if (!isHydrated) return <LoadingDialog loading={true} error={null} />

  return children
}
