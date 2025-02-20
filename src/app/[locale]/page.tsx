'use client';

import VideoAudioControls from '@/components/VideoAudioControls'
import LocalVideo from '@/components/LocalVideo'
import RemoteVideo from '@/components/RemoteVideo'
import UserList from '@/components/UserList'
import CallHistory from '@/components/CallHistory'
import { useWebRTCContext, WebRTCProvider } from '@/hooks/webrtc/WebRTCProvider'
import { DetailedCallHistoryProvider } from '@/store/DetailedCallHistoryProvider'
import DetailedCallHistoryDialog from '@/components/DetailedCallHistoryDialog'
import CallerDialog from '@/components/CallerDialog'
import CalleeDialog from '@/components/CalleeDialog'

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UserList />
            <CallHistory />
          </div>
        </div>
      )}
      <VideoAudioControls />
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