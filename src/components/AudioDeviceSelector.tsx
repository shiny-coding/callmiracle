import DeviceSelector from './DeviceSelector'
import { useStore } from '@/store/useStore'
import { useDeviceSelection } from '@/hooks/useDeviceSelection'

export default function AudioDeviceSelector() {
  const { localAudioEnabled } = useStore((state) => ({
    localAudioEnabled: state.localAudioEnabled
  }))

  const deviceSelection = useDeviceSelection({
    kind: 'audioinput',
    storageKey: 'selectedAudioDevice',
    isEnabled: localAudioEnabled
  })

  return (
    <DeviceSelector
      devices={deviceSelection.devices}
      deviceLabels={deviceSelection.deviceLabels}
      selectedDevice={deviceSelection.selectedDevice}
      onDeviceChange={deviceSelection.handleDeviceChange}
    />
  )
} 