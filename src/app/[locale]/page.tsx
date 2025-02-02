'use client';

import { Container } from '@mui/material'
import VideoAudioControls from '@/components/VideoAudioControls'
import LocalVideo from '@/components/LocalVideo'
import RemoteVideo from '@/components/RemoteVideo'
import UserList from '@/components/UserList'
import { useWebRTCContext, WebRTCProvider } from '@/hooks/webrtc/WebRTCProvider'

function MainContent() {
  const { connectionStatus } = useWebRTCContext()

  return (
    <Container maxWidth="xl" className="h-screen flex flex-col items-center justify-center">
      <div className="relative w-full h-full max-w-[1536px] mx-auto">
        <RemoteVideo />
        <LocalVideo />
        {connectionStatus !== 'connected' && (
          <div className="absolute left-0 right-0 bottom-20 px-4 max-h-[calc(100vh-500px)] overflow-y-auto">
            <UserList />
          </div>
        )}
        <VideoAudioControls />
      </div>
    </Container>
  )
}

export default function Home() {
  return (
    <WebRTCProvider>
      <MainContent />
    </WebRTCProvider>
  )
} 