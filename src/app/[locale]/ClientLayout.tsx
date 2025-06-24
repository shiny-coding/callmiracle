'use client'
import { usePathname } from "next/navigation"
import { AppContent } from "@/components/AppContent";
import { WebRTCProvider } from "@/hooks/webrtc/WebRTCProvider";
import { DetailedCallHistoryProvider } from "@/store/DetailedCallHistoryProvider";
import { ConversationsProvider } from "@/store/ConversationsProvider";
import { useWebRTCContext } from "@/hooks/webrtc/WebRTCProvider";
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
      <WebRTCProvider>
        <DetailedCallHistoryProvider>
          <ConversationsProvider>
            <MainContent>
              {children}
            </MainContent>
          </ConversationsProvider>
        </DetailedCallHistoryProvider>
      </WebRTCProvider>
    </AppContent>
}

function MainContent({ children }: { children: React.ReactNode }) {
  const { connectionStatus, callee } = useWebRTCContext()

  return (
    <>
      {/* {connectionStatus !== 'connected' && (
        <video className="video-bg" autoPlay muted loop playsInline>
          <source src="/output-8x.mp4" type="video/mp4" />
        </video>
      )} */}
      <div className="flex flex-col items-center w-full max-w-[1536px] mx-auto" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        {connectionStatus !== 'connected' && (
          <TopControlsBar />
        )}
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
