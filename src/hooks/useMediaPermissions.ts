import { useState, useEffect, useCallback } from 'react'
import clientLogger from '@/utils/clientLogger'

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
    const timestamp = Date.now()
    clientLogger.debug('[MediaPermissions] checkPermissions called', {
      timestamp,
      isIOS
    })

    try {
      // Try to enumerate devices to check if we have permissions
      const devices = await navigator.mediaDevices.enumerateDevices()

      clientLogger.debug('[MediaPermissions] Devices enumerated', {
        deviceCount: devices.length,
        videoDevices: devices.filter(d => d.kind === 'videoinput').length,
        audioDevices: devices.filter(d => d.kind === 'audioinput').length,
        hasLabels: devices.some(device => device.label !== '')
      })

      // If devices have labels, permissions are granted
      const hasLabels = devices.some(device => device.label !== '')

      if (hasLabels) {
        clientLogger.info('[MediaPermissions] Permissions granted (devices have labels)', {
          timestamp
        })
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

          clientLogger.debug('[MediaPermissions] Permission API result', {
            camera: cameraPermission.state,
            microphone: micPermission.state
          })

          setPermissions({
            camera: cameraPermission.state as PermissionState,
            microphone: micPermission.state as PermissionState
          })
          return
        } catch (err) {
          // Permission API not supported or names not recognized (iOS Safari)
          clientLogger.debug('[MediaPermissions] Permission API not available', {
            error: err instanceof Error ? err.message : String(err)
          })
          console.log('[MediaPermissions] Permission API not available')
        }
      }

      // Default to 'prompt' if we can't determine
      clientLogger.info('[MediaPermissions] Defaulting to prompt state')
      setPermissions({
        camera: 'prompt',
        microphone: 'prompt'
      })
    } catch (err) {
      clientLogger.error('[MediaPermissions] Error checking permissions', {
        error: err instanceof Error ? err.message : String(err)
      })
      console.error('[MediaPermissions] Error checking permissions:', err)
      setPermissions({
        camera: 'prompt',
        microphone: 'prompt'
      })
    }
  }, [isIOS])

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const timestamp = Date.now()
    const callStack = new Error().stack
    clientLogger.info('[MediaPermissions] requestPermissions called', {
      timestamp,
      isIOS,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      callStack: callStack?.split('\n').slice(0, 5).join(' | ')
    })

    try {
      // Request both video and audio
      const constraints = {
        video: true,
        audio: true
      }

      clientLogger.debug('[MediaPermissions] Calling getUserMedia', {
        constraints,
        timestamp
      })

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      clientLogger.info('[MediaPermissions] getUserMedia success in requestPermissions', {
        timestamp,
        timeTaken: Date.now() - timestamp,
        streamId: stream.id,
        trackCount: stream.getTracks().length,
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          id: t.id,
          label: t.label,
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted,
          settings: t.getSettings()
        }))
      })

      // Clean up the stream immediately
      stream.getTracks().forEach(track => {
        clientLogger.debug('[MediaPermissions] Stopping permission test track', {
          kind: track.kind,
          id: track.id,
          label: track.label
        })
        track.stop()
      })

      clientLogger.info('[MediaPermissions] Permission test stream stopped, updating state to granted')

      // Update state to granted
      setPermissions({
        camera: 'granted',
        microphone: 'granted'
      })

      return true
    } catch (err: any) {
      clientLogger.error('[MediaPermissions] Error requesting permissions', {
        timestamp,
        timeTaken: Date.now() - timestamp,
        errorName: err?.name,
        errorMessage: err?.message,
        error: err
      })
      console.error('[MediaPermissions] Error requesting permissions:', err)

      // Check if it's a permission denial or other error
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        clientLogger.warn('[MediaPermissions] Permission denied by user')
        setPermissions({
          camera: 'denied',
          microphone: 'denied'
        })
      } else {
        clientLogger.warn('[MediaPermissions] Permission request failed (not denial)', {
          errorName: err?.name
        })
        // Other errors (device not found, etc.)
        setPermissions({
          camera: 'prompt',
          microphone: 'prompt'
        })
      }

      return false
    }
  }, [isIOS])

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
