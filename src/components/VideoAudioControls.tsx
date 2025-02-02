import { IconButton } from '@mui/material'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import MoodIcon from '@mui/icons-material/Mood'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import VideoDeviceSelector from './VideoDeviceSelector'
import AudioDeviceSelector from './AudioDeviceSelector'
import ProfileSettings from './ProfileSettings'
import StatusSettings from './StatusSettings'
import { useState } from 'react'

export default function VideoAudioControls() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const {
    localAudioEnabled,
    localVideoEnabled,
    handleAudioToggle,
    handleVideoToggle,
    connectionStatus,
    hangup
  } = useWebRTCContext()

  return (
    <div className="p-4 w-full flex justify-center items-center gap-4 bg-gradient-to-t from-black/50 to-transparent">
      {connectionStatus !== 'connected' && (
        <div className="absolute left-4 flex gap-2">
          <IconButton
            className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
            onClick={() => setProfileOpen(true)}
          >
            <AccountCircleIcon className="text-white" />
          </IconButton>
          <IconButton
            className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
            onClick={() => setStatusOpen(true)}
          >
            <MoodIcon className="text-white" />
          </IconButton>
        </div>
      )}

      <div className="flex items-center gap-4">
        {connectionStatus === 'connected' && (
          <IconButton
            className="bg-red-500 hover:bg-red-600"
            onClick={hangup}
          >
            <CallEndIcon className="text-white" />
          </IconButton>
        )}
        
        <IconButton
          className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
          onClick={handleAudioToggle}
        >
          {localAudioEnabled ? (
            <MicIcon className="text-white" />
          ) : (
            <MicOffIcon className="text-white" />
          )}
        </IconButton>
        <AudioDeviceSelector />

        <IconButton
          className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
          onClick={handleVideoToggle}
        >
          {localVideoEnabled ? (
            <VideocamIcon className="text-white" />
          ) : (
            <VideocamOffIcon className="text-white" />
          )}
        </IconButton>
        <VideoDeviceSelector />
      </div>

      <ProfileSettings 
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <StatusSettings
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
      />
    </div>
  )
} 