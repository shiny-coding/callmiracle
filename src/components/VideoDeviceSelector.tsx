import { FormControl, Select, MenuItem } from '@mui/material'
import { useState, useEffect } from 'react'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'

async function getDeviceLabel(device: MediaDeviceInfo): Promise<string | null> {
  try {
    // Try to get capabilities by creating a stream
    if (device.deviceId) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: device.deviceId }
      })
      const track = stream.getVideoTracks()[0]
      const capabilities = track.getCapabilities()
      
      // Clean up the stream
      stream.getTracks().forEach(track => track.stop())
      
      if (capabilities.facingMode) {
        if (capabilities.facingMode.includes('user')) return 'Front Camera'
        if (capabilities.facingMode.includes('environment')) return 'Back Camera'
      }

      // If no clear indication, return the original label or a generic name
      return device.label || `Camera ${device.deviceId.slice(0, 5)}...`
    }
  } catch (err) {
    // If we can't get a stream, it's likely a virtual camera
    return null
  }

  return null
}

export default function VideoDeviceSelector() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceLabels, setDeviceLabels] = useState<Record<string, string>>({})
  const { localVideoEnabled, setLocalStream } = useWebRTCContext()
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)

  // Initialize client-side only state
  useEffect(() => {
    setSelectedDevice(localStorage.getItem('selectedVideoDevice') || '')
  }, [])

  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(d => d.kind === 'videoinput')
        
        // Filter and get labels for real cameras
        const realDevices: MediaDeviceInfo[] = []
        const labels: Record<string, string> = {}
        
        for (const device of videoDevices) {
          const label = await getDeviceLabel(device)
          if (label !== null) {
            realDevices.push(device)
            labels[device.deviceId] = label
          }
        }
        
        setDevices(realDevices)
        setDeviceLabels(labels)
      } catch (err) {
        console.error('Error getting video devices:', err)
      }
    }
    getDevices()
  }, [])

  const handleChange = async (deviceId: string) => {
    setSelectedDevice(deviceId)
    localStorage.setItem('selectedVideoDevice', deviceId)

    // Update the stream with the new device
    try {
      // Create new stream with selected device
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId } : true,
        audio: false // Don't include audio when switching video device
      }

      if (localVideoEnabled) {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        setLocalStream(newStream)
      }
    } catch (err) {
      console.error('Error switching camera:', err)
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
              {deviceLabels[device.deviceId] || device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
            </MenuItem>
          ))}
        </Select>
      </div>
    </FormControl>
  )
} 