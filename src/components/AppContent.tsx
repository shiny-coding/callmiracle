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
import { InitialMessageHandler } from './InitialMessageHandler'
import PWARequiredScreen from './PWARequiredScreen'
import NotificationPermissionDeniedScreen from './NotificationPermissionDeniedScreen'
import NotificationPermissionRequestScreen from './NotificationPermissionRequestScreen'
import { useShouldShowPWAScreen } from '@/hooks/useShouldShowPWAScreen'
import { useShouldShowNotificationDeniedScreen, useShouldShowNotificationRequestScreen } from '@/hooks/useShouldShowNotificationDeniedScreen'

interface AppContentProps {
  children: ReactNode
}

export function AppContent({ children }: AppContentProps) {
  const { loading, error } = useInitUser()
  const shouldShowPWAScreen = useShouldShowPWAScreen()
  const shouldShowNotificationRequestScreen = useShouldShowNotificationRequestScreen()
  const shouldShowNotificationDeniedScreen = useShouldShowNotificationDeniedScreen()

  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  return (
    <SubscriptionsProvider>
      <MeetingsProvider>
        <UsersProvider>
          <GroupsProvider>
            <SnackbarProvider>
              <InitialMessageHandler />
              <NotificationsProvider>
                {shouldShowPWAScreen ? (
                  <PWARequiredScreen />
                ) : shouldShowNotificationRequestScreen ? (
                  <NotificationPermissionRequestScreen />
                ) : shouldShowNotificationDeniedScreen ? (
                  <NotificationPermissionDeniedScreen />
                ) : (
                  children
                )}
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
