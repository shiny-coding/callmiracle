import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import DeviceSelector from './DeviceSelector'

export default function AudioDeviceSelector() {
  const { localAudioEnabled, setLocalStream } = useWebRTCContext()

  const getStream = async (deviceId: string) => {
    return navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId } : true,
      video: false
    })
  }

  return (
    <DeviceSelector
      kind="audioinput"
      storageKey="selectedAudioDevice"
      getStream={getStream}
      isEnabled={localAudioEnabled}
      setStream={setLocalStream}
    />
  )
} 