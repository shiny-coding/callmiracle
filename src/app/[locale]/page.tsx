'use client';

import VideoAudioControls from '@/components/VideoAudioControls'
import LocalVideo from '@/components/LocalVideo'
import RemoteVideo from '@/components/RemoteVideo'
import UserList from '@/components/UserList'
import { useWebRTCContext, WebRTCProvider } from '@/hooks/webrtc/WebRTCProvider'
import { useState } from 'react'
import { IconButton } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import CloseIcon from '@mui/icons-material/Close'

function MainContent() {
  const [showUserList, setShowUserList] = useState(true)
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
      
      <IconButton
        onClick={() => setShowUserList(!showUserList)}
        className="fixed top-4 right-4 bg-black/30 backdrop-blur-sm hover:bg-black/40 z-50"
      >
        {showUserList ? (
          <CloseIcon className="text-black" />
        ) : (
          <PeopleIcon className="text-black" />
        )}
      </IconButton>

      {connectionStatus !== 'connected' && showUserList && (
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