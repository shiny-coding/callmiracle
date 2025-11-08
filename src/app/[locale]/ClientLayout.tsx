'use client'
import React, { useEffect, useState } from 'react'
import { usePathname } from "next/navigation"
import { AppContent } from "@/components/AppContent";
import { WebRTCProvider } from "@/hooks/webrtc/WebRTCProvider";
import { DetailedCallHistoryProvider } from "@/store/DetailedCallHistoryProvider";
import { ConversationsProvider } from "@/store/ConversationsProvider";
import { useWebRTCContext } from "@/hooks/webrtc/WebRTCProvider";
import { ServerProvider } from "@/contexts/ServerContext";
import ConnectedCallLayout from "@/components/ConnectedCallLayout";
import DisconnectedLayout from "@/components/DisconnectedLayout";
import DeviceSettingsDialog from "@/components/DeviceSettingsDialog";
import PermissionDeniedDialog from "@/components/PermissionDeniedDialog";
import { useStore } from "@/store/useStore";
import { useMediaPermissions } from "@/hooks/useMediaPermissions";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const authRoute = '/auth'

  return pathname.includes(authRoute) ?
    children :
    <AppContent>
      <ServerProvider>
        <WebRTCProvider>
          <DetailedCallHistoryProvider>
            <ConversationsProvider>
              <MainContent>
                {children}
              </MainContent>
            </ConversationsProvider>
          </DetailedCallHistoryProvider>
        </WebRTCProvider>
      </ServerProvider>
    </AppContent>
}

function MainContent({ children }: { children: React.ReactNode }) {
  const { connectionStatus } = useWebRTCContext()
  const { deviceSettingsOpen, setDeviceSettingsOpen } = useStore((state) => ({
    deviceSettingsOpen: state.deviceSettingsOpen,
    setDeviceSettingsOpen: state.setDeviceSettingsOpen
  }))

  const { permissions, requestPermissions, isIOS } = useMediaPermissions()
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false)

  // Removed automatic permission request on mount
  // Permissions will now be requested only when:
  // 1. User opens device settings dialog
  // 2. User initiates a call
  // 3. User receives a call

  const handleRetryPermissions = async () => {
    console.log('[MainContent] Retrying permissions request')
    const granted = await requestPermissions()

    if (granted) {
      setPermissionDialogOpen(false)
    }
    // On iOS, the page will refresh, so no need to handle the false case
  }

  return (
    <>
      {connectionStatus === 'connected' ? (
        <ConnectedCallLayout />
      ) : (
        <DisconnectedLayout>
          {children}
        </DisconnectedLayout>
      )}
      <DeviceSettingsDialog
        open={deviceSettingsOpen}
        onClose={() => setDeviceSettingsOpen(false)}
      />
      <PermissionDeniedDialog
        open={permissionDialogOpen}
        onClose={() => setPermissionDialogOpen(false)}
        onRetry={handleRetryPermissions}
        isIOS={isIOS}
      />
    </>
  )
}
