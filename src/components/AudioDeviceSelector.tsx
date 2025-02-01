import { FormControl, Select, MenuItem } from '@mui/material'
import { useState, useEffect } from 'react'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'

export default function AudioDeviceSelector() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const { localAudioEnabled, setLocalStream } = useWebRTCContext()
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)

  // Initialize client-side only state
  useEffect(() => {
    setSelectedDevice(localStorage.getItem('selectedAudioDevice') || '')
  }, [])

  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setDevices(devices.filter(d => d.kind === 'audioinput'))
      } catch (err) {
        console.error('Error getting audio devices:', err)
      }
    }
    getDevices()
  }, [])

  const handleChange = async (deviceId: string) => {
    setSelectedDevice(deviceId)
    localStorage.setItem('selectedAudioDevice', deviceId)

    // Update the stream with the new device
    try {
      // Create new stream with selected device
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId } : true,
        video: false // Don't include video when switching audio device
      }

      if (localAudioEnabled) {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        setLocalStream(newStream)
      }
    } catch (err) {
      console.error('Error switching microphone:', err)
    }
  }

  if (devices.length === 0) return null

  return (
    <FormControl size="small" className="w-10">
      <div className="relative">
        {!isOpen && (
          <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={() => setIsOpen(true)}>
            <div className="w-0 h-0 border-[6px] border-transparent border-t-gray-500 transform rotate-180 -mt-1" />
          </div>
        )}
        <Select
          value={selectedDevice}
          onChange={(e) => handleChange(e.target.value)}
          variant="standard"
          className={`dark:text-gray-100 ${!isOpen ? 'opacity-0' : 'dark:bg-gray-700'}`}
          open={isOpen}
          onOpen={() => setIsOpen(true)}
          onClose={() => setIsOpen(false)}
          IconComponent={() => null}
          renderValue={() => ''}
        >
          {devices.map(device => (
            <MenuItem 
              key={device.deviceId} 
              value={device.deviceId}
              className="dark:text-gray-100 dark:hover:bg-gray-600"
            >
              {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
            </MenuItem>
          ))}
        </Select>
      </div>
    </FormControl>
  )
} 