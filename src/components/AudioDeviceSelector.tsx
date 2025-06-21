import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import DeviceSelector from './DeviceSelector'
import { useStore } from '@/store/useStore'

export default function AudioDeviceSelector() {
  const { setLocalStream } = useWebRTCContext()
  const { localAudioEnabled } = useStore((state) => ({
    localAudioEnabled: state.localAudioEnabled
  }))

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