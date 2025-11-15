'use client'

import { useTranslations } from 'next-intl'
import { useDeviceSelection } from '@/hooks/useDeviceSelection'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { useEffect, useRef, useState } from 'react'
import { IconButton, Button, Dialog, DialogTitle, DialogContent } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import clientLogger from '@/utils/clientLogger'

// Clean up device name by removing hardware IDs like (046d:082d)
function cleanDeviceName(name: string): string {
  // Remove patterns like (046d:082d) or similar hardware identifiers
  return name.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim()
}

async function getVideoDeviceLabel(device: MediaDeviceInfo, existingStream?: MediaStream): Promise<string | null> {
  try {
    if (!device.deviceId) return null

    // If device already has a label from permissions, use it to determine camera type
    if (device.label) {
      const labelLower = device.label.toLowerCase()
      if (labelLower.includes('front') || labelLower.includes('user')) return 'Front Camera'
      if (labelLower.includes('back') || labelLower.includes('rear') || labelLower.includes('environment')) return 'Back Camera'

      // Return the label as-is if it doesn't match known patterns
      return device.label
    }

    // Don't create test streams - causes issues on iOS
    // Just return a generic label
    return `Camera ${device.deviceId.slice(0, 5)}...`
  } catch (err) {
    return null
  }
}

interface DeviceSettingsDialogProps {
  open: boolean
  onClose: () => void
}

export default function DeviceSettingsDialog({ open, onClose }: DeviceSettingsDialogProps) {
  const t = useTranslations()
  const { localVideoEnabled, localAudioEnabled, setLocalVideoEnabled, setLocalAudioEnabled } = useStore((state) => ({
    localVideoEnabled: state.localVideoEnabled,
    localAudioEnabled: state.localAudioEnabled,
    setLocalVideoEnabled: state.setLocalVideoEnabled,
    setLocalAudioEnabled: state.setLocalAudioEnabled
  }))
  const { localStream, connectionStatus, sendWantedMediaState } = useWebRTCContext()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLandscape, setIsLandscape] = useState(true)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const previewStreamRef = useRef<MediaStream | null>(null)
  const isCreatingStreamRef = useRef(false) // Prevent concurrent stream creation
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user') // For iOS camera switching
  const { permissions, requestPermissions, isIOS } = useMediaPermissions()

  // Request permissions when dialog opens
  useEffect(() => {
    if (!open) return

    async function ensurePermissions() {
      // Check if permissions are already granted
      if (permissions.camera === 'granted' && permissions.microphone === 'granted') {
        console.log('[DeviceSettings] Permissions already granted')
        return
      }

      // If permissions are still checking, wait
      if (permissions.camera === 'checking' || permissions.microphone === 'checking') {
        return
      }

      // Request permissions
      console.log('[DeviceSettings] Requesting media permissions')
      await requestPermissions()
    }

    ensurePermissions()
  }, [open, permissions, requestPermissions])

  const videoDevices = useDeviceSelection({
    kind: 'videoinput',
    storageKey: 'selectedVideoDevice',
    isEnabled: localVideoEnabled,
    getLabel: (device) => getVideoDeviceLabel(device, previewStream || undefined)
  })

  const audioDevices = useDeviceSelection({
    kind: 'audioinput',
    storageKey: 'selectedAudioDevice',
    isEnabled: localAudioEnabled
  })

  // Cleanup preview stream immediately when dialog closes
  useEffect(() => {
    if (!open) {
      clientLogger.info('[DeviceSettings] Dialog closed, starting cleanup', {
        hasPreviewStream: !!previewStreamRef.current,
        trackCount: previewStreamRef.current?.getTracks().length || 0
      })

      // Cleanup function for iOS camera indicator
      const cleanup = () => {
        // Pause video first
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.srcObject = null
          videoRef.current.removeAttribute('src')
          videoRef.current.load()
        }

        // Stop all tracks
        if (previewStreamRef.current) {
          const tracks = previewStreamRef.current.getTracks()
          tracks.forEach(track => {
            clientLogger.info('[DeviceSettings] Stopping track on dialog close', {
              trackId: track.id,
              kind: track.kind,
              label: track.label,
              readyState: track.readyState
            })
            track.stop()
          })
          previewStreamRef.current = null
        }
        setPreviewStream(null)
      }

      cleanup()
      clientLogger.info('[DeviceSettings] Cleanup completed on dialog close')
      return
    } else {
      clientLogger.info('[DeviceSettings] Dialog opened', {
        localVideoEnabled,
        connectionStatus
      })
    }

    async function createPreviewStream() {
      // Prevent concurrent stream creation
      if (isCreatingStreamRef.current) {
        clientLogger.info('[DeviceSettings] Skipping createPreviewStream - already creating', {
          currentFlag: isCreatingStreamRef.current
        })
        return
      }

      if (!localVideoEnabled) {
        clientLogger.info('[DeviceSettings] Video disabled, cleaning up preview stream')
        // Clear video element srcObject first
        if (videoRef.current) {
          videoRef.current.srcObject = null
        }

        // Then stop all tracks
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach(track => track.stop())
          previewStreamRef.current = null
        }
        setPreviewStream(null)
        return
      }

      isCreatingStreamRef.current = true
      clientLogger.info('[DeviceSettings] Setting isCreatingStreamRef to true in createPreviewStream')
      try {
        const selectedVideoDevice = localStorage.getItem('selectedVideoDevice') || ''
        clientLogger.info('[DeviceSettings] Creating preview stream', {
          selectedVideoDevice: selectedVideoDevice.slice(0, 20) + '...',
          connectionStatus,
          hasOldStream: !!previewStreamRef.current,
          flagState: isCreatingStreamRef.current,
          isIOS,
          currentFacingMode
        })

        // During a call, create a separate preview stream
        // Not during a call, use the existing localStream
        if (connectionStatus === 'connected') {
          // Clear video element srcObject first
          if (videoRef.current) {
            videoRef.current.srcObject = null
          }

          // Stop old preview stream if exists
          if (previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach(track => track.stop())
          }

          // On iOS, use facingMode instead of deviceId for better compatibility
          const constraints: MediaStreamConstraints = {
            video: isIOS
              ? { facingMode: currentFacingMode }
              : selectedVideoDevice ? { deviceId: selectedVideoDevice } : true,
            audio: false // No audio needed for preview
          }

          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          const tracks = stream.getVideoTracks()

          clientLogger.info('[DeviceSettings] Preview stream created (connected)', {
            streamId: stream.id,
            trackCount: tracks.length,
            trackLabel: tracks[0]?.label,
            trackId: tracks[0]?.id
          })

          previewStreamRef.current = stream
          setPreviewStream(stream)
        } else {
          // Clear video element srcObject first
          if (videoRef.current) {
            videoRef.current.srcObject = null
          }

          // Stop old preview stream if exists
          if (previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach(track => track.stop())
          }

          // On iOS, use facingMode instead of deviceId for better compatibility
          const constraints: MediaStreamConstraints = {
            video: isIOS
              ? { facingMode: currentFacingMode }
              : selectedVideoDevice ? { deviceId: selectedVideoDevice } : true,
            audio: false // No audio needed for preview
          }

          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          const tracks = stream.getVideoTracks()

          clientLogger.info('[DeviceSettings] Preview stream created (not connected)', {
            streamId: stream.id,
            trackCount: tracks.length,
            trackLabel: tracks[0]?.label,
            trackId: tracks[0]?.id
          })

          previewStreamRef.current = stream
          setPreviewStream(stream)
        }
      } catch (err) {
        clientLogger.error('[DeviceSettings] Error creating preview stream', {
          error: err instanceof Error ? err.message : String(err)
        })
        setPreviewStream(null)
      } finally {
        clientLogger.info('[DeviceSettings] Resetting isCreatingStreamRef to false in createPreviewStream finally')
        isCreatingStreamRef.current = false
      }
    }

    createPreviewStream()

    // Cleanup function that runs when effect dependencies change or component unmounts
    return () => {
      clientLogger.info('[DeviceSettings] useEffect cleanup running', {
        hasPreviewStream: !!previewStreamRef.current,
        trackCount: previewStreamRef.current?.getTracks().length || 0,
        flagState: isCreatingStreamRef.current
      })

      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.srcObject = null
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
      }

      if (previewStreamRef.current) {
        const tracks = previewStreamRef.current.getTracks()
        tracks.forEach(track => {
          clientLogger.info('[DeviceSettings] Stopping track in useEffect cleanup', {
            trackId: track.id,
            kind: track.kind,
            label: track.label,
            readyState: track.readyState
          })
          track.stop()
        })
        previewStreamRef.current = null
      }
    }
  }, [open, localStream, localVideoEnabled, connectionStatus])

  // Attach preview stream to video element
  useEffect(() => {
    if (videoRef.current && open) {
      if (previewStream && localVideoEnabled) {
        videoRef.current.srcObject = previewStream

      } else {
        videoRef.current.srcObject = null
      }
    }
  }, [previewStream, localVideoEnabled, open])

  // Detect aspect ratio
  useEffect(() => {
    const checkAspectRatio = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setIsLandscape(width > height)
      }
    }

    checkAspectRatio()
    window.addEventListener('resize', checkAspectRatio)
    return () => window.removeEventListener('resize', checkAspectRatio)
  }, [])

  // iOS-specific: Toggle between front and back camera using facingMode
  const handleIOSCameraToggle = async () => {
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user'

    clientLogger.info('[DeviceSettings] iOS camera toggle requested', {
      currentFacingMode,
      newFacingMode
    })

    try {
      // Stop current stream
      if (previewStreamRef.current) {
        const tracks = previewStreamRef.current.getTracks()
        tracks.forEach(track => {
          clientLogger.info('[DeviceSettings] Stopping track for iOS camera toggle', {
            trackId: track.id,
            readyState: track.readyState
          })
          track.stop()
        })
        previewStreamRef.current = null
      }
      setPreviewStream(null)

      // Clear video element
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.srcObject = null
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
      }

      // Update facingMode
      setCurrentFacingMode(newFacingMode)

      // Wait for iOS to release camera hardware
      clientLogger.info('[DeviceSettings] Waiting 100ms for iOS camera release before requesting new facingMode')
      await new Promise(resolve => setTimeout(resolve, 100))

      // Request new stream with new facingMode
      const constraints: MediaStreamConstraints = {
        video: { facingMode: newFacingMode },
        audio: false
      }

      clientLogger.info('[DeviceSettings] Requesting new stream with facingMode', { facingMode: newFacingMode })
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const tracks = stream.getVideoTracks()

      clientLogger.info('[DeviceSettings] New iOS camera stream acquired', {
        streamId: stream.id,
        trackCount: tracks.length,
        trackLabel: tracks[0]?.label,
        facingMode: newFacingMode
      })

      previewStreamRef.current = stream
      setPreviewStream(stream)
    } catch (err) {
      clientLogger.error('[DeviceSettings] Error toggling iOS camera', {
        error: err instanceof Error ? err.message : String(err),
        attemptedFacingMode: newFacingMode
      })
    }
  }

  const handleVideoDeviceChange = async (deviceId: string) => {
    if (deviceId === 'disabled') {
      clientLogger.info('[DeviceSettings] Video device disabled')
      setLocalVideoEnabled(false)
      // Notify peer if in a call
      if (connectionStatus === 'connected') {
        sendWantedMediaState()
      }
    } else {
      // On iOS, we don't use deviceId-based switching, only facingMode toggle
      if (isIOS) {
        clientLogger.info('[DeviceSettings] iOS detected - ignoring deviceId-based switch, use facingMode toggle instead')
        setLocalVideoEnabled(true)
        return
      }

      // Non-iOS: Standard deviceId-based switching
      clientLogger.info('[DeviceSettings] Video device change requested', {
        newDeviceId: deviceId.slice(0, 20) + '...'
      })

      setLocalVideoEnabled(true)
      await videoDevices.handleDeviceChange(deviceId)

      // Notify peer if in a call
      if (connectionStatus === 'connected') {
        sendWantedMediaState()
      }
    }
  }

  const handleAudioDeviceChange = async (deviceId: string) => {
    if (deviceId === 'disabled') {
      setLocalAudioEnabled(false)
      // Notify peer if in a call
      if (connectionStatus === 'connected') {
        sendWantedMediaState()
      }
    } else {
      console.log('[DeviceSettings] Enabling audio and changing device')
      setLocalAudioEnabled(true)
      await audioDevices.handleDeviceChange(deviceId)

      // Notify peer if in a call
      if (connectionStatus === 'connected') {
        sendWantedMediaState()
      }
    }
  }

  const handleClose = () => {
    clientLogger.info('[DeviceSettings] handleClose called', {
      hasPreviewStream: !!previewStreamRef.current,
      trackCount: previewStreamRef.current?.getTracks().length || 0
    })

    // Stop all tracks
    if (previewStreamRef.current) {
      const tracks = previewStreamRef.current.getTracks()
      tracks.forEach(track => {
        clientLogger.info('[DeviceSettings] Stopping track in handleClose', {
          trackId: track.id,
          kind: track.kind,
          readyState: track.readyState
        })
        track.stop()
      })
      previewStreamRef.current = null
    }
    setPreviewStream(null)

    // Clear video element
    if (videoRef.current) {
      clientLogger.info('[DeviceSettings] Clearing video element in handleClose')
      videoRef.current.pause()
      videoRef.current.srcObject = null
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }

    clientLogger.info('[DeviceSettings] handleClose completed, calling onClose')
    onClose()
  }

  const handleContentClick = (e: React.MouseEvent) => {
    // Close dialog if clicking directly on the content area (not on buttons)
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '800px'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {t('deviceSettings')}
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label={t('close')}
          title={t('close')}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}
        onClick={handleContentClick}
      >
        <div
          ref={containerRef}
          className={`flex ${isLandscape ? 'flex-row' : 'flex-col'} gap-4 flex-1 min-h-0`}
          onClick={handleContentClick}
        >
          {/* Video preview section */}
          <div
            className={`${isLandscape ? 'w-1/2' : 'flex-1'} flex items-center justify-center min-h-0`}
            onClick={handleContentClick}
          >
            <div
              className="relative w-full h-full bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center"
              onClick={handleContentClick}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`max-w-full max-h-full object-contain ${!localVideoEnabled ? 'opacity-0 pointer-events-none absolute' : ''}`}
              />
              {!localVideoEnabled && (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  {t('cameraDisabled')}
                </div>
              )}
            </div>
          </div>

          {/* Device selection section */}
          <div
            className={`${isLandscape ? 'w-1/2' : 'flex-1'} flex flex-col gap-4 overflow-y-auto min-h-0`}
            onClick={handleContentClick}
          >
            {/* Video devices */}
            <div onClick={handleContentClick}>
              <div className="text-lg font-medium mb-2 dark:text-gray-100">
                {t('camera')}
              </div>
              <div className="flex flex-col gap-2">
                {/* Disabled option */}
                <Button
                  fullWidth
                  variant={!localVideoEnabled ? "contained" : "outlined"}
                  onClick={() => handleVideoDeviceChange('disabled')}
                  sx={{ justifyContent: 'flex-start !important', textAlign: 'left', px: 3 }}
                >
                  {t('cameraDisabled')}
                </Button>

                {/* iOS: Show separate buttons for front/back camera */}
                {isIOS && localVideoEnabled && (
                  <>
                    <Button
                      fullWidth
                      variant={currentFacingMode === 'user' ? "contained" : "outlined"}
                      onClick={() => {
                        if (currentFacingMode !== 'user') {
                          handleIOSCameraToggle()
                        }
                      }}
                      sx={{ justifyContent: 'flex-start !important', textAlign: 'left', px: 3 }}
                    >
                      {t('frontCamera') || 'Front Camera'}
                    </Button>
                    <Button
                      fullWidth
                      variant={currentFacingMode === 'environment' ? "contained" : "outlined"}
                      onClick={() => {
                        if (currentFacingMode !== 'environment') {
                          handleIOSCameraToggle()
                        }
                      }}
                      sx={{ justifyContent: 'flex-start !important', textAlign: 'left', px: 3 }}
                    >
                      {t('backCamera') || 'Back Camera'}
                    </Button>
                  </>
                )}

                {/* Non-iOS: Available devices */}
                {!isIOS && videoDevices.devices.map(device => (
                  <Button
                    key={device.deviceId}
                    fullWidth
                    variant={localVideoEnabled && videoDevices.selectedDevice === device.deviceId ? "contained" : "outlined"}
                    onClick={() => handleVideoDeviceChange(device.deviceId)}
                    sx={{ justifyContent: 'flex-start !important', textAlign: 'left', px: 3 }}
                  >
                    {cleanDeviceName(videoDevices.deviceLabels[device.deviceId] || device.label || `Device ${device.deviceId.slice(0, 5)}...`)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Audio devices */}
            <div onClick={handleContentClick}>
              <div className="text-lg font-medium mb-2 dark:text-gray-100">
                {t('microphone')}
              </div>
              <div className="flex flex-col gap-2">
                {/* Disabled option */}
                <Button
                  fullWidth
                  variant={!localAudioEnabled ? "contained" : "outlined"}
                  onClick={() => handleAudioDeviceChange('disabled')}
                  sx={{ justifyContent: 'flex-start !important', textAlign: 'left', px: 3 }}
                >
                  {t('microphoneDisabled')}
                </Button>

                {/* Available devices */}
                {audioDevices.devices.map(device => (
                  <Button
                    key={device.deviceId}
                    fullWidth
                    variant={localAudioEnabled && audioDevices.selectedDevice === device.deviceId ? "contained" : "outlined"}
                    onClick={() => handleAudioDeviceChange(device.deviceId)}
                    sx={{ justifyContent: 'flex-start !important', textAlign: 'left', px: 3 }}
                  >
                    {cleanDeviceName(device.label || `Device ${device.deviceId.slice(0, 5)}...`)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
