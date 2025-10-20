'use client'
import React from 'react'
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
import { useStore } from "@/store/useStore";

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
    </>
  )
}
