import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import DeviceSelector from './DeviceSelector'
import { useStore } from '@/store/useStore'

interface VideoDeviceSelectorProps {
  onOpenChange?: (isOpen: boolean) => void;
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
  const { setLocalStream } = useWebRTCContext()
  const { localVideoEnabled } = useStore()

  const getStream = async (deviceId: string) => {
    return navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId } : true,
      audio: false
    })
  }

  return (
    <DeviceSelector
      kind="videoinput"
      storageKey="selectedVideoDevice"
      getStream={getStream}
      isEnabled={localVideoEnabled}
      setStream={setLocalStream}
      getLabel={getDeviceLabel}
      onOpenChange={onOpenChange}
    />
  )
} 