import { FormControl, Select, MenuItem } from '@mui/material'
import { useState, useEffect } from 'react'

interface DeviceSelectorProps {
  devices: MediaDeviceInfo[]
  deviceLabels: Record<string, string>
  selectedDevice: string
  onDeviceChange: (deviceId: string) => void
  onOpenChange?: (isOpen: boolean) => void
}

export default function DeviceSelector({
  devices,
  deviceLabels,
  selectedDevice,
  onDeviceChange,
  onOpenChange,
}: DeviceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  if (devices.length === 0) return null

  return (
    <FormControl size="small" className="w-10">
      <div className="relative">
        {!isOpen && (
          <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={() => setIsOpen(true)}>
            <div className="w-0 h-0 border-[6px] border-transparent border-t-gray-500 transform rotate-180 -mt-1" />
          </div>
        )}
        <div className="dropdown-root">
          <Select
            value={selectedDevice}
            onChange={(e) => onDeviceChange(e.target.value)}
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
                {deviceLabels[device.deviceId] || device.label || `Device ${device.deviceId.slice(0, 5)}...`}
              </MenuItem>
            ))}
          </Select>
        </div>
      </div>
    </FormControl>
  )
} 