'use client';

import VideoAudioControls from '@/components/VideoAudioControls'
import LocalVideo from '@/components/LocalVideo'
import RemoteVideo from '@/components/RemoteVideo'
import UserList from '@/components/UserList'
import { useWebRTCContext, WebRTCProvider } from '@/hooks/webrtc/WebRTCProvider'

function MainContent() {
  const { connectionStatus } = useWebRTCContext()

  return (
    <div className="h-full flex flex-col items-center w-full max-w-[1536px] mx-auto">
      <div className={`${connectionStatus === 'connected' 
        ? 'absolute bottom-[72px] right-4 z-10 w-[240px]' 
        : 'flex justify-center pt-4'
      }`}>
        <LocalVideo />
      </div>
      <div className={`flex items-center justify-center w-full h-full ${
        connectionStatus === 'connected' ? 'relative opacity-100' : 'absolute opacity-0 pointer-events-none'
      }`}>
        <RemoteVideo />
      </div>

      {connectionStatus !== 'connected' && (
        <div className="px-4 mt-4 overflow-y-auto pb-4">
          <UserList />
        </div>
      )}
      <VideoAudioControls />
    </div>
  )
}

export default function Home() {
  return (
    <WebRTCProvider>
      <MainContent />
    </WebRTCProvider>
  )
} 