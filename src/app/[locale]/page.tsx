'use client';

import LocalVideo from '@/components/LocalVideo'
import RemoteVideo from '@/components/RemoteVideo'
import { useWebRTCContext, WebRTCProvider } from '@/hooks/webrtc/WebRTCProvider'
import { DetailedCallHistoryProvider } from '@/store/DetailedCallHistoryProvider'
import DetailedCallHistoryDialog from '@/components/DetailedCallHistoryDialog'
import CallerDialog from '@/components/CallerDialog'
import CalleeDialog from '@/components/CalleeDialog'
import BottomControlsBar from '@/components/BottomControlsBar';
import MeetingsList from '@/components/MeetingsList';

function MainContent() {
  const { connectionStatus, callee } = useWebRTCContext()

  return (
    <div className="h-full bg-black flex flex-col items-center w-full max-w-[1536px] mx-auto">
      <div className={`${connectionStatus === 'connected' 
        ? 'absolute bottom-[72px] right-4 z-10 w-[240px]' 
        : 'flex justify-center pt-4'
      }`}>
        <LocalVideo />
      </div>
      <div className={`flex items-center justify-center w-full h-[calc(100%-72px)] ${
        connectionStatus === 'connected' ? 'relative opacity-100' : 'absolute opacity-0 pointer-events-none'
      }`}>
        <RemoteVideo />
      </div>

      {connectionStatus !== 'connected' && (
        <div className="px-4 mt-4 overflow-y-auto pb-4 w-full max-w-[800px]">
          <MeetingsList />
        </div>
      )}
      <BottomControlsBar />
      <DetailedCallHistoryDialog />
      <CallerDialog />
      <CalleeDialog callee={callee} />
    </div>
  )
}

export default function Home() {
  return (
    <WebRTCProvider>
      <DetailedCallHistoryProvider>
        <MainContent />
      </DetailedCallHistoryProvider>
    </WebRTCProvider>
  )
} 