import { useState, useEffect } from 'react'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useStore } from '@/store/useStore'

interface UseDeviceSelectionProps {
  kind: 'audioinput' | 'videoinput'
  storageKey: string
  isEnabled: boolean
  getLabel?: (device: MediaDeviceInfo) => Promise<string | null>
}

export function useDeviceSelection({
  kind,
  storageKey,
  isEnabled,
  getLabel
}: UseDeviceSelectionProps) {
  const { setLocalStream } = useWebRTCContext()
  const { localVideoEnabled, localAudioEnabled } = useStore((state) => ({
    localVideoEnabled: state.localVideoEnabled,
    localAudioEnabled: state.localAudioEnabled
  }))
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceLabels, setDeviceLabels] = useState<Record<string, string>>({})
  const [selectedDevice, setSelectedDevice] = useState<string>('')

  // Initialize client-side only state
  useEffect(() => {
    setSelectedDevice(localStorage.getItem(storageKey) || '')
  }, [storageKey])

  // Fetch devices
  useEffect(() => {
    let isMounted = true

    async function getDevices() {
      try {
        console.log(`[useDeviceSelection] Starting device enumeration for ${kind}`)
        const devices = await navigator.mediaDevices.enumerateDevices()
        const filteredDevices = devices.filter(d => d.kind === kind)
        console.log(`[useDeviceSelection] Found ${filteredDevices.length} devices of kind ${kind}`, {
          devices: filteredDevices.map(d => ({ id: d.deviceId.slice(0, 10), label: d.label }))
        })

        if (!isMounted) return

        if (getLabel) {
          // Filter and get labels for devices that support streaming
          const realDevices: MediaDeviceInfo[] = []
          const labels: Record<string, string> = {}

          for (const device of filteredDevices) {
            console.log(`[useDeviceSelection] Getting label for device ${device.deviceId.slice(0, 10)}`)
            const label = await getLabel(device)
            console.log(`[useDeviceSelection] Device ${device.deviceId.slice(0, 10)} label result: ${label}`)
            if (label !== null) {
              realDevices.push(device)
              labels[device.deviceId] = label
            } else {
              console.warn(`[useDeviceSelection] Device ${device.deviceId.slice(0, 10)} filtered out - label was null`)
            }
          }

          if (!isMounted) return

          console.log(`[useDeviceSelection] After filtering: ${realDevices.length} devices with labels`)
          setDevices(realDevices)
          setDeviceLabels(labels)

          // Auto-select first device if none is selected and devices are available
          const currentSelected = localStorage.getItem(storageKey) || ''
          console.log(`[useDeviceSelection] Current selection from localStorage: "${currentSelected}"`)
          // Don't auto-select if user has explicitly disabled this device type
          if (!currentSelected && realDevices.length > 0) {
            const firstDevice = realDevices[0]
            console.log(`[useDeviceSelection] Auto-selecting first ${kind}: ${firstDevice.deviceId}`)
            setSelectedDevice(firstDevice.deviceId)
            localStorage.setItem(storageKey, firstDevice.deviceId)
          } else if (currentSelected === 'disabled') {
            // User has explicitly disabled this device type, respect that choice
            console.log(`[useDeviceSelection] Device explicitly disabled by user, not auto-selecting`)
            setSelectedDevice('')
          } else if (currentSelected && currentSelected !== 'disabled' && !realDevices.find(d => d.deviceId === currentSelected)) {
            // If selected device is no longer available, select the first available one
            if (realDevices.length > 0) {
              const firstDevice = realDevices[0]
              console.log(`[useDeviceSelection] Previously selected device not available, selecting first ${kind}: ${firstDevice.deviceId}`)
              setSelectedDevice(firstDevice.deviceId)
              localStorage.setItem(storageKey, firstDevice.deviceId)
            }
          } else {
            console.log(`[useDeviceSelection] Using existing selection: ${currentSelected}`)
          }
        } else {
          console.log(`[useDeviceSelection] No getLabel function, using ${filteredDevices.length} devices as-is`)
          setDevices(filteredDevices)

          // Auto-select first device if none is selected and devices are available
          const currentSelected = localStorage.getItem(storageKey) || ''
          console.log(`[useDeviceSelection] Current selection from localStorage: "${currentSelected}"`)
          // Don't auto-select if user has explicitly disabled this device type
          if (!currentSelected && filteredDevices.length > 0) {
            const firstDevice = filteredDevices[0]
            console.log(`[useDeviceSelection] Auto-selecting first ${kind}: ${firstDevice.deviceId}`)
            setSelectedDevice(firstDevice.deviceId)
            localStorage.setItem(storageKey, firstDevice.deviceId)
          } else if (currentSelected === 'disabled') {
            // User has explicitly disabled this device type, respect that choice
            console.log(`[useDeviceSelection] Device explicitly disabled by user, not auto-selecting`)
            setSelectedDevice('')
          } else if (currentSelected && currentSelected !== 'disabled' && !filteredDevices.find(d => d.deviceId === currentSelected)) {
            // If selected device is no longer available, select the first available one
            if (filteredDevices.length > 0) {
              const firstDevice = filteredDevices[0]
              console.log(`[useDeviceSelection] Previously selected device not available, selecting first ${kind}: ${firstDevice.deviceId}`)
              setSelectedDevice(firstDevice.deviceId)
              localStorage.setItem(storageKey, firstDevice.deviceId)
            }
          } else {
            console.log(`[useDeviceSelection] Using existing selection: ${currentSelected}`)
          }
        }
      } catch (err) {
        console.error('Error getting devices:', { error: err instanceof Error ? err.message : String(err) })
      }
    }

    // Initial device enumeration
    getDevices()

    // Listen for device changes (connect/disconnect)
    const handleDeviceChange = () => {
      console.log('[useDeviceSelection] Device change detected, re-enumerating devices')
      getDevices()
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    // Monitor permission changes
    let permissionStatus: PermissionStatus | null = null
    const permissionName = kind === 'videoinput' ? 'camera' : 'microphone'

    const setupPermissionMonitoring = async () => {
      try {
        // @ts-ignore - TypeScript doesn't recognize 'camera' and 'microphone' as valid values
        permissionStatus = await navigator.permissions.query({ name: permissionName })

        const handlePermissionChange = () => {
          console.log(`[useDeviceSelection] ${permissionName} permission changed to ${permissionStatus?.state}, re-enumerating devices`)
          getDevices()
        }

        permissionStatus.addEventListener('change', handlePermissionChange)

        // Store cleanup function
        return () => {
          permissionStatus?.removeEventListener('change', handlePermissionChange)
        }
      } catch (err) {
        // Permission API might not be supported or permission name not recognized
        console.log(`[useDeviceSelection] Permission monitoring not available for ${permissionName}`, {
          error: err instanceof Error ? err.message : String(err)
        })
        return () => {}
      }
    }

    let cleanupPermission: (() => void) | null = null
    setupPermissionMonitoring().then(cleanup => {
      if (isMounted) {
        cleanupPermission = cleanup
      } else {
        cleanup()
      }
    })

    return () => {
      isMounted = false
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
      cleanupPermission?.()
    }
  }, [kind, getLabel])

  const handleDeviceChange = async (deviceId: string) => {
    const previousDevice = selectedDevice
    setSelectedDevice(deviceId)
    localStorage.setItem(storageKey, deviceId)

    // Update the stream with the new device
    try {
      if (isEnabled) {
        // Get the other device ID from localStorage to maintain both tracks
        const otherStorageKey = kind === 'videoinput' ? 'selectedAudioDevice' : 'selectedVideoDevice'
        const otherDeviceId = localStorage.getItem(otherStorageKey) || ''

        // Check if the other track type is enabled
        const otherEnabled = kind === 'videoinput' ? localAudioEnabled : localVideoEnabled

        const constraints: MediaStreamConstraints = {}

        if (kind === 'videoinput') {
          constraints.video = deviceId ? { deviceId } : true
          // Include audio only if it's enabled
          if (localAudioEnabled) {
            constraints.audio = otherDeviceId ? { deviceId: otherDeviceId } : true
          }
        } else {
          constraints.audio = deviceId ? { deviceId } : true
          // Include video only if it's enabled
          if (localVideoEnabled) {
            constraints.video = otherDeviceId ? { deviceId: otherDeviceId } : true
          }
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        setLocalStream(newStream)
      }
    } catch (err) {
      console.error('Error switching device:', { error: err instanceof Error ? err.message : String(err) })
      // Revert to previous device on error
      setSelectedDevice(previousDevice)
      localStorage.setItem(storageKey, previousDevice)
      alert(`Failed to switch ${kind === 'videoinput' ? 'camera' : 'microphone'}. The device may not be available or may not have active content.`)
    }
  }

  return {
    devices,
    deviceLabels,
    selectedDevice,
    handleDeviceChange
  }
}
