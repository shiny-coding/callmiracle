import DeviceSelector from './DeviceSelector'
import { useStore } from '@/store/useStore'
import { useDeviceSelection } from '@/hooks/useDeviceSelection'

interface VideoDeviceSelectorProps {
  onOpenChange?: (isOpen: boolean) => void
}

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