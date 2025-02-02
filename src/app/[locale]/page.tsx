'use client';

import { Container } from '@mui/material'
import VideoAudioControls from '@/components/VideoAudioControls'
import LocalVideo from '@/components/LocalVideo'
import RemoteVideo from '@/components/RemoteVideo'
import { WebRTCProvider } from '@/hooks/webrtc/WebRTCProvider'

export default function Home() {
  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <div className="relative w-full h-full max-w-[1536px] mx-auto">
        <RemoteVideo />
        <LocalVideo />
        <VideoAudioControls />
      </div>
    </div>
  )
} 