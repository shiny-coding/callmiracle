import { FormControl, Select, MenuItem } from '@mui/material'
import { useState, useEffect } from 'react'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'

interface DeviceSelectorProps {
  kind: 'audioinput' | 'videoinput'
  storageKey: string
  getStream: (deviceId: string) => Promise<MediaStream>
  isEnabled: boolean
  setStream: (stream: MediaStream | undefined) => void
  getLabel?: (device: MediaDeviceInfo) => Promise<string | null>
  onOpenChange?: (isOpen: boolean) => void
}

export default function DeviceSelector({ 
  kind, 
  storageKey, 
  getStream, 
  isEnabled,
  setStream,
  getLabel,
  onOpenChange
}: DeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceLabels, setDeviceLabels] = useState<Record<string, string>>({})
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  // Initialize client-side only state
  useEffect(() => {
    setSelectedDevice(localStorage.getItem(storageKey) || '')
  }, [storageKey])

  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const filteredDevices = devices.filter(d => d.kind === kind)
        
        if (getLabel) {
          // Filter and get labels for devices that support streaming
          const realDevices: MediaDeviceInfo[] = []
          const labels: Record<string, string> = {}
          
          for (const device of filteredDevices) {
            const label = await getLabel(device)
            if (label !== null) {
              realDevices.push(device)
              labels[device.deviceId] = label
            }
          }
          
          setDevices(realDevices)
          setDeviceLabels(labels)
        } else {
          setDevices(filteredDevices)
        }
      } catch (err) {
        console.error('Error getting devices:', err)
      }
    }
    getDevices()
  }, [kind, getLabel])

  const handleChange = async (deviceId: string) => {
    setSelectedDevice(deviceId)
    localStorage.setItem(storageKey, deviceId)

    // Update the stream with the new device
    try {
      if (isEnabled) {
        const newStream = await getStream(deviceId)
        setStream(newStream)
      }
    } catch (err) {
      console.error('Error switching device:', err)
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
              {getLabel ? deviceLabels[device.deviceId] : device.label || `Device ${device.deviceId.slice(0, 5)}...`}
            </MenuItem>
          ))}
        </Select>
      </div>
    </FormControl>
  )
} 