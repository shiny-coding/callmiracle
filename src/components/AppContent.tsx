'use client'

import { ReactNode, useState, useEffect } from 'react'
import { useInitUser } from '@/hooks/useInitUser'
import { useStore } from '@/store/useStore'
import { UsersProvider } from '@/store/UsersProvider'
import { GroupsProvider } from '@/store/GroupsProvider'
import { SubscriptionsProvider } from '@/contexts/SubscriptionsContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import { MeetingsProvider } from '@/contexts/MeetingsContext'
import LoadingDialog from './LoadingDialog'
import { vanillaStore } from '@/store/useStore'
import { SnackbarProvider } from '@/contexts/SnackContext'

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
          <GroupsProvider>
            <SnackbarProvider>
              <NotificationsProvider>
                {children}
              </NotificationsProvider>
            </SnackbarProvider>
          </GroupsProvider>
        </UsersProvider>
      </MeetingsProvider>
    </SubscriptionsProvider>
  )
} 

export function StoreInitializer({ children }: AppContentProps) {
  
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const initiallyHydrated = vanillaStore.persist.hasHydrated();
    setIsHydrated(initiallyHydrated);

    if (!initiallyHydrated) {
      const unsub = vanillaStore.persist.onFinishHydration(() => {
        setIsHydrated(true);
        unsub();
      });
    }
  }, []);

  if (!isHydrated) return <LoadingDialog loading={true} error={null} />

  return children
}
