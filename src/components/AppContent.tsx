'use client'

import { ReactNode, useState } from 'react'
import { useInitUser } from '@/hooks/useInitUser'
import { Dialog, DialogContent, Typography } from '@mui/material'
import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { UsersProvider } from '@/store/UsersProvider'
import { SubscriptionsProvider } from '@/contexts/SubscriptionsContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'

interface AppContentProps {
  children: ReactNode
}

export function AppContent({ children }: AppContentProps) {
  const { loading, error } = useInitUser()
  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  return (
        <UsersProvider>
          <SubscriptionsProvider>
            <NotificationsProvider>
              {children}
            </NotificationsProvider>
          </SubscriptionsProvider>
        </UsersProvider>
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

function LoadingDialog({ loading, error }: { loading: boolean, error: any }) {
    return (
      <Dialog
        open={true}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          className: 'bg-gray-900'
        }}
      >
        <DialogContent className="flex items-center justify-center min-h-[120px]">
          <Typography className="text-white text-center text-lg">
            {loading ? 'Loading...' : 'Server is down. Please try again later'}
          </Typography>
        </DialogContent>
      </Dialog>
    )
}