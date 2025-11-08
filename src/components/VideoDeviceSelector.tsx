import DeviceSelector from './DeviceSelector'
import { useStore } from '@/store/useStore'
import { useDeviceSelection } from '@/hooks/useDeviceSelection'

interface VideoDeviceSelectorProps {
  onOpenChange?: (isOpen: boolean) => void
}

async function getDeviceLabel(device: MediaDeviceInfo): Promise<string | null> {
  try {
    if (!device.deviceId) return null

    // If device already has a label from permissions, use it to determine camera type
    if (device.label) {
      const labelLower = device.label.toLowerCase()
      if (labelLower.includes('front') || labelLower.includes('user')) return 'Front Camera'
      if (labelLower.includes('back') || labelLower.includes('rear') || labelLower.includes('environment')) return 'Back Camera'
      // Return the device label if it doesn't match known patterns
      return device.label
    }

    // Fallback to generic name
    return `Camera ${device.deviceId.slice(0, 5)}...`
  } catch (err) {
    return null
  }
}

export default function VideoDeviceSelector({ onOpenChange }: VideoDeviceSelectorProps) {
  const { localVideoEnabled } = useStore((state) => ({
    localVideoEnabled: state.localVideoEnabled
  }))

  const deviceSelection = useDeviceSelection({
    kind: 'videoinput',
    storageKey: 'selectedVideoDevice',
    isEnabled: localVideoEnabled,
    getLabel: getDeviceLabel
  })

  return (
    <DeviceSelector
      devices={deviceSelection.devices}
      deviceLabels={deviceSelection.deviceLabels}
      selectedDevice={deviceSelection.selectedDevice}
      onDeviceChange={deviceSelection.handleDeviceChange}
      onOpenChange={onOpenChange}
    />
  )
} 