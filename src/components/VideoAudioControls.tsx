import { IconButton } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import VideoDeviceSelector from './VideoDeviceSelector'
import AudioDeviceSelector from './AudioDeviceSelector'

export default function VideoAudioControls() {
  const { 
    localVideoEnabled, 
    setLocalVideoEnabled, 
    localAudioEnabled, 
    setLocalAudioEnabled 
  } = useWebRTCContext()

  const handleVideoToggle = () => {
    const newState = !localVideoEnabled
    setLocalVideoEnabled(newState)
    localStorage.setItem('cameraEnabled', String(newState))
  }

  const handleAudioToggle = () => {
    const newState = !localAudioEnabled
    setLocalAudioEnabled(newState)
    localStorage.setItem('audioEnabled', String(newState))
  }

  return (
    <div className="flex gap-2">
      <div className="flex items-center">
        <IconButton 
          onClick={handleAudioToggle}
          className="bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
          size="medium"
        >
          {localAudioEnabled ? (
            <MicIcon className="text-blue-500" />
          ) : (
            <MicOffIcon className="text-gray-500" />
          )}
        </IconButton>
        <AudioDeviceSelector />
      </div>
      <div className="flex items-center">
        <IconButton 
          onClick={handleVideoToggle}
          className="bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
          size="medium"
        >
          {localVideoEnabled ? (
            <VideocamIcon className="text-blue-500" />
          ) : (
            <VideocamOffIcon className="text-gray-500" />
          )}
        </IconButton>
        <VideoDeviceSelector />
      </div>
    </div>
  )
} 