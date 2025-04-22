import { IconButton, Badge } from '@mui/material'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import NotificationsIcon from '@mui/icons-material/Notifications'
import MoodIcon from '@mui/icons-material/Mood'
import SettingsIcon from '@mui/icons-material/Settings'
import HistoryIcon from '@mui/icons-material/History'
import PeopleIcon from '@mui/icons-material/People'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import VideoDeviceSelector from './VideoDeviceSelector'
import AudioDeviceSelector from './AudioDeviceSelector'
import ProfileDialog from './ProfileDialog'
import MeetingDialog from './MeetingDialog'
import VideoQualitySelector from './VideoQualitySelector'
import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import CallHistoryPopup from './CallHistoryPopup'
import UsersPopup from './UsersPopup'
import NotificationsPopup from './NotificationsPopup'
import { useNotifications } from '@/contexts/NotificationsContext'
import LocalVideo from './LocalVideo'

let mousePosition = { x: 0, y: 0 }

document.addEventListener("mousemove", function (event) {
  mousePosition = { x: event.clientX, y: event.clientY }
});

export default function BottomControlsBar() {
  const [callHistoryOpen, setCallHistoryOpen] = useState(false)
  const [usersPopupOpen, setUsersPopupOpen] = useState(false)
  const [isHoveringOverVideoControls, setIsHoveringOverVideoControls] = useState(false)
  const [isVideoDeviceSelectorOpen, setIsVideoDeviceSelectorOpen] = useState(false)
  
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

  // Handle video device selector open state
  const handleVideoDeviceSelectorOpen = (isOpen: boolean) => {
    setIsVideoDeviceSelectorOpen(isOpen)
  }

  const videoContainerWidth = connectionStatus !== 'connected' ? 400 : 240

  return (
    <>
      <div 
        className={`absolute bottom-[72px] right-4 z-10 w-[${videoContainerWidth}px] transition-opacity duration-300`}
        style={{ visibility: isHoveringOverVideoControls || isVideoDeviceSelectorOpen ? 'visible' : 'hidden' }}
      >
        <LocalVideo />
      </div>

      <div className="mt-auto p-4 w-full flex justify-between items-center gap-4 bg-gradient-to-b from-black to-white/50">
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

          <div 
            className="flex gap-2 items-center"
            onMouseEnter={() => setIsHoveringOverVideoControls(true)}
            onMouseLeave={() => setIsHoveringOverVideoControls(false)}
          >
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
            <VideoDeviceSelector onOpenChange={handleVideoDeviceSelectorOpen} />
          </div>
        </div>
        {connectionStatus !== 'connected' && (
          <>
            <CallHistoryPopup
              open={callHistoryOpen}
              onClose={() => setCallHistoryOpen(false)}
            />
            <UsersPopup
              open={usersPopupOpen}
              onClose={() => setUsersPopupOpen(false)}
            />
          </>
        )}
      </div>
    </>
  )
} 