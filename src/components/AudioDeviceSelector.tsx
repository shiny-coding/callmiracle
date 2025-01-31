import { FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { useState, useEffect } from 'react'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'

export default function AudioDeviceSelector() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const { localAudioEnabled, setLocalStream } = useWebRTCContext()
  const [selectedDevice, setSelectedDevice] = useState<string>('')

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
    <FormControl size="small" className="min-w-[200px] dark:bg-gray-700 rounded-lg">
      <InputLabel className="dark:text-gray-300">Microphone</InputLabel>
      <Select
        value={selectedDevice}
        onChange={(e) => handleChange(e.target.value)}
        label="Microphone"
        className="dark:text-gray-100"
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
    </FormControl>
  )
} 