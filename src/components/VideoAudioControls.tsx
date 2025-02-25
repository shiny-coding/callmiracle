import { IconButton } from '@mui/material'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import MoodIcon from '@mui/icons-material/Mood'
import SettingsIcon from '@mui/icons-material/Settings'
import HistoryIcon from '@mui/icons-material/History'
import PeopleIcon from '@mui/icons-material/People'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import VideoDeviceSelector from './VideoDeviceSelector'
import AudioDeviceSelector from './AudioDeviceSelector'
import ProfileSettings from './ProfileSettings'
import MeetingDialog from './MeetingDialog'
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import CallHistoryPopup from './CallHistoryPopup'
import UsersPopup from './UsersPopup'

export default function BottomControlsBar() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [callHistoryOpen, setCallHistoryOpen] = useState(false)
  const [usersPopupOpen, setUsersPopupOpen] = useState(false)
  const {
    localAudioEnabled,
    localVideoEnabled,
    setLocalAudioEnabled,
    setLocalVideoEnabled,
  } = useStore()
  const {
    connectionStatus,
    hangup,
    sendWantedMediaState
  } = useWebRTCContext()

  const handleAudioToggle = () => {
    setLocalAudioEnabled(!localAudioEnabled)
    sendWantedMediaState()
  }

  const handleVideoToggle = () => {
    setLocalVideoEnabled(!localVideoEnabled)
    sendWantedMediaState()
  }


  return (
    <div className="mt-auto p-4 w-full flex justify-around items-center gap-4 bg-gradient-to-b from-black to-white/50">
      {connectionStatus !== 'connected' && (
        <div className="flex gap-2 items-center">
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
      {connectionStatus !== 'connected' && (
        <div className="flex gap-2 items-center">
          <IconButton onClick={() => setUsersPopupOpen(true)}>
            <PeopleIcon />
          </IconButton>
          <IconButton onClick={() => setCallHistoryOpen(true)}>
            <HistoryIcon />
          </IconButton>
        </div>
      )}
      {connectionStatus === 'connected' && (
        <div>
          <IconButton
            className="bg-red-600 hover:bg-red-700 text-white" 
            onClick={hangup}
          >
            <CallEndIcon className="text-red-400" />
          </IconButton>
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="text-sm text-white/80 capitalize min-w-[80px] text-center">
          {connectionStatus === 'connected' ? 'Connected' : connectionStatus}
        </div>

        <div className="flex gap-2 items-center">
          <IconButton
            className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
            onClick={handleAudioToggle}
          >
            {localAudioEnabled ? (
              <MicIcon className="text-white" />
            ) : (
              <MicOffIcon className="text-red-400" />
            )}
          </IconButton>
          <AudioDeviceSelector />
        </div>

        <div className="flex gap-2 items-center">
          <IconButton
            className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
            onClick={handleVideoToggle}
          >
            {localVideoEnabled ? (
              <VideocamIcon className="text-white" />
            ) : (
              <VideocamOffIcon className="text-red-400" />
            )}
          </IconButton>
          <VideoDeviceSelector />
        </div>
      </div>

      <ProfileSettings 
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <MeetingDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
      />
      <CallHistoryPopup
        open={callHistoryOpen}
        onClose={() => setCallHistoryOpen(false)}
      />
      <UsersPopup
        open={usersPopupOpen}
        onClose={() => setUsersPopupOpen(false)}
      />
    </div>
  )
} 