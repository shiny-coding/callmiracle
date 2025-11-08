import { useState, useEffect, useCallback } from 'react'

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'checking'

interface MediaPermissionsState {
  camera: PermissionState
  microphone: PermissionState
}

interface UseMediaPermissionsResult {
  permissions: MediaPermissionsState
  requestPermissions: () => Promise<boolean>
  checkPermissions: () => Promise<void>
  isIOS: boolean
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false

  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

export function useMediaPermissions(): UseMediaPermissionsResult {
  const [permissions, setPermissions] = useState<MediaPermissionsState>({
    camera: 'checking',
    microphone: 'checking'
  })
  const [isIOS] = useState(detectIOS)

  // Check current permission status
  const checkPermissions = useCallback(async () => {
    try {
      // Try to enumerate devices to check if we have permissions
      const devices = await navigator.mediaDevices.enumerateDevices()

      // If devices have labels, permissions are granted
      const hasLabels = devices.some(device => device.label !== '')

      if (hasLabels) {
        setPermissions({
          camera: 'granted',
          microphone: 'granted'
        })
        return
      }

      // Try to use Permission API (not supported on iOS Safari)
      if ('permissions' in navigator) {
        try {
          // @ts-ignore - TypeScript doesn't recognize 'camera' and 'microphone'
          const cameraPermission = await navigator.permissions.query({ name: 'camera' })
          // @ts-ignore
          const micPermission = await navigator.permissions.query({ name: 'microphone' })

          setPermissions({
            camera: cameraPermission.state as PermissionState,
            microphone: micPermission.state as PermissionState
          })
          return
        } catch (err) {
          // Permission API not supported or names not recognized (iOS Safari)
          console.log('[MediaPermissions] Permission API not available')
        }
      }

      // Default to 'prompt' if we can't determine
      setPermissions({
        camera: 'prompt',
        microphone: 'prompt'
      })
    } catch (err) {
      console.error('[MediaPermissions] Error checking permissions:', err)
      setPermissions({
        camera: 'prompt',
        microphone: 'prompt'
      })
    }
  }, [])

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      // Request both video and audio
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })

      // Clean up the stream immediately
      stream.getTracks().forEach(track => track.stop())

      // Update state to granted
      setPermissions({
        camera: 'granted',
        microphone: 'granted'
      })

      return true
    } catch (err: any) {
      console.error('[MediaPermissions] Error requesting permissions:', err)

      // Check if it's a permission denial or other error
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissions({
          camera: 'denied',
          microphone: 'denied'
        })
      } else {
        // Other errors (device not found, etc.)
        setPermissions({
          camera: 'prompt',
          microphone: 'prompt'
        })
      }

      return false
    }
  }, [])

  // Check permissions on mount
  useEffect(() => {
    checkPermissions()
  }, [checkPermissions])

  return {
    permissions,
    requestPermissions,
    checkPermissions,
    isIOS
  }
}
