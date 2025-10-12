'use client'
import React from 'react'
import { usePathname } from "next/navigation"
import { AppContent } from "@/components/AppContent";
import { WebRTCProvider } from "@/hooks/webrtc/WebRTCProvider";
import { DetailedCallHistoryProvider } from "@/store/DetailedCallHistoryProvider";
import { ConversationsProvider } from "@/store/ConversationsProvider";
import { useWebRTCContext } from "@/hooks/webrtc/WebRTCProvider";
import { ServerProvider } from "@/contexts/ServerContext";
import TopControlsBar from "@/components/TopControlsBar";
import RemoteVideo from "@/components/RemoteVideo";
import BottomControlsBar from "@/components/BottomControlsBar";
import DetailedCallHistoryDialog from "@/components/DetailedCallHistoryDialog";
import CallerDialog from "@/components/CallerDialog";
import CalleeDialog from "@/components/CalleeDialog";

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
  const { connectionStatus, callee } = useWebRTCContext()
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const showVideo = connectionStatus === 'calling' || connectionStatus === 'receiving-call'

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.5
    }
  }, [])

  return (
    <>
      {showVideo && (
        <video ref={videoRef} className="video-bg-dialog" autoPlay muted loop playsInline>
          <source src="/fallingstars.mp4" type="video/mp4" />
        </video>
      )}
      <div className="flex flex-col w-full" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        {connectionStatus !== 'connected' && (
          <TopControlsBar />
        )}
        <div className="flex flex-col items-center w-full max-w-[1536px] mx-auto grow overflow-hidden">
          <div className={`flex items-center justify-center w-full h-[calc(100%-72px)] ${
            connectionStatus === 'connected' ? 'relative opacity-100' : 'absolute opacity-0 pointer-events-none'
          }`}>
            <RemoteVideo />
          </div>

          {connectionStatus !== 'connected' && (
            <div className="overflow-y-auto px-2 w-full max-w-[800px] grow">
              {children}
            </div>
          )}
        </div>
        <BottomControlsBar />
        {connectionStatus !== 'connected' && (
          <>
            <DetailedCallHistoryDialog />
            <CallerDialog />
            <CalleeDialog callee={callee} />
          </>
        )}
      </div>
    </>
  )
}
