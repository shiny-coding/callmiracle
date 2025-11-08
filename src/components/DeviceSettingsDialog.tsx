'use client'

import { useTranslations } from 'next-intl'
import { useDeviceSelection } from '@/hooks/useDeviceSelection'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { useEffect, useRef, useState } from 'react'
import { IconButton, Button, Dialog, DialogTitle, DialogContent } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

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
    }

    // Only create a new stream if we have an existing stream (permissions already granted)
    // This avoids triggering permission prompts on iOS
    if (existingStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: device.deviceId }
        })
        const track = stream.getVideoTracks()[0]
        const capabilities = track.getCapabilities()

        stream.getTracks().forEach(track => track.stop())

        if (capabilities.facingMode) {
          if (capabilities.facingMode.includes('user')) return 'Front Camera'
          if (capabilities.facingMode.includes('environment')) return 'Back Camera'
        }
      } catch (err) {
        // If stream creation fails, device is not available
        return null
      }
    }

    return device.label || `Camera ${device.deviceId.slice(0, 5)}...`
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
  const { permissions, requestPermissions } = useMediaPermissions()

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

  // Create and manage preview stream
  useEffect(() => {
    if (!open) {
      // Cleanup when dialog closes
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(track => {
          track.stop()
        })
        previewStreamRef.current = null
        setPreviewStream(null)
      }
      return
    }

    async function createPreviewStream() {
      if (!localVideoEnabled) {
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach(track => track.stop())
          previewStreamRef.current = null
        }
        setPreviewStream(null)
        return
      }

      try {
        const selectedVideoDevice = localStorage.getItem('selectedVideoDevice') || ''

        // During a call, create a separate preview stream
        // Not during a call, use the existing localStream
        if (connectionStatus === 'connected') {
          
          // Stop old preview stream if exists
          if (previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach(track => track.stop())
          }

          const constraints: MediaStreamConstraints = {
            video: selectedVideoDevice ? { deviceId: selectedVideoDevice } : true,
            audio: false // No audio needed for preview
          }

          const stream = await navigator.mediaDevices.getUserMedia(constraints)

          previewStreamRef.current = stream
          setPreviewStream(stream)
        } else {
          // Stop old preview stream if exists
          if (previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach(track => track.stop())
          }

          const constraints: MediaStreamConstraints = {
            video: selectedVideoDevice ? { deviceId: selectedVideoDevice } : true,
            audio: false // No audio needed for preview
          }

          const stream = await navigator.mediaDevices.getUserMedia(constraints)

          previewStreamRef.current = stream
          setPreviewStream(stream)
        }
      } catch (err) {
        console.error('[DeviceSettings] Error creating preview stream:', err)
        setPreviewStream(null)
      }
    }

    createPreviewStream()
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

  const handleVideoDeviceChange = async (deviceId: string) => {

    if (deviceId === 'disabled') {
      setLocalVideoEnabled(false)
      // Notify peer if in a call
      if (connectionStatus === 'connected') {
        sendWantedMediaState()
      }
    } else {
      setLocalVideoEnabled(true)
      await videoDevices.handleDeviceChange(deviceId)

      // Notify peer if in a call
      if (connectionStatus === 'connected') {
        sendWantedMediaState()

        // Update the preview stream with the new device
        try {
          // Stop old preview stream
          if (previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach(track => track.stop())
          }

          const constraints: MediaStreamConstraints = {
            video: { deviceId },
            audio: false
          }

          const stream = await navigator.mediaDevices.getUserMedia(constraints)

          previewStreamRef.current = stream
          setPreviewStream(stream)
        } catch (err) {
          console.error('[DeviceSettings] Error updating preview stream:', err)
        }
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

  const handleContentClick = (e: React.MouseEvent) => {
    // Close dialog if clicking directly on the content area (not on buttons)
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          onClick={onClose}
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

                {/* Available devices */}
                {videoDevices.devices.map(device => (
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
