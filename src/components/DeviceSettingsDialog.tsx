'use client'

import { useTranslations } from 'next-intl'
import { useDeviceSelection } from '@/hooks/useDeviceSelection'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useEffect, useRef, useState } from 'react'
import { IconButton, Button, Dialog, DialogTitle, DialogContent } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

// Clean up device name by removing hardware IDs like (046d:082d)
function cleanDeviceName(name: string): string {
  // Remove patterns like (046d:082d) or similar hardware identifiers
  return name.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim()
}

async function getVideoDeviceLabel(device: MediaDeviceInfo): Promise<string | null> {
  try {
    if (device.deviceId) {
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

      return device.label || `Camera ${device.deviceId.slice(0, 5)}...`
    }
  } catch (err) {
    return null
  }
  return null
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
  const { localStream, connectionStatus } = useWebRTCContext()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLandscape, setIsLandscape] = useState(true)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const previewStreamRef = useRef<MediaStream | null>(null)

  const videoDevices = useDeviceSelection({
    kind: 'videoinput',
    storageKey: 'selectedVideoDevice',
    isEnabled: localVideoEnabled,
    getLabel: getVideoDeviceLabel
  })

  const audioDevices = useDeviceSelection({
    kind: 'audioinput',
    storageKey: 'selectedAudioDevice',
    isEnabled: localAudioEnabled
  })

  // Create and manage preview stream
  useEffect(() => {
    if (!open) {
      console.log('[DeviceSettings] Dialog closed, cleaning up preview stream')
      // Cleanup when dialog closes
      if (previewStreamRef.current) {
        console.log('[DeviceSettings] Stopping preview stream tracks')
        previewStreamRef.current.getTracks().forEach(track => {
          console.log(`[DeviceSettings] Stopping track: ${track.kind}, id: ${track.id}, state: ${track.readyState}`)
          track.stop()
        })
        previewStreamRef.current = null
        setPreviewStream(null)
      }
      return
    }

    console.log('[DeviceSettings] Dialog opened, connectionStatus:', connectionStatus)
    console.log('[DeviceSettings] localVideoEnabled:', localVideoEnabled)
    console.log('[DeviceSettings] localStream exists:', !!localStream)

    if (localStream) {
      const videoTracks = localStream.getVideoTracks()
      console.log('[DeviceSettings] localStream video tracks:', videoTracks.length)
      videoTracks.forEach((track, idx) => {
        console.log(`[DeviceSettings] Video track ${idx}: id=${track.id}, label=${track.label}, enabled=${track.enabled}, readyState=${track.readyState}, muted=${track.muted}`)
      })
    }

    async function createPreviewStream() {
      if (!localVideoEnabled) {
        console.log('[DeviceSettings] Video disabled, clearing preview')
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach(track => track.stop())
          previewStreamRef.current = null
        }
        setPreviewStream(null)
        return
      }

      try {
        const selectedVideoDevice = localStorage.getItem('selectedVideoDevice') || ''
        console.log('[DeviceSettings] Selected video device:', selectedVideoDevice)

        // During a call, create a separate preview stream
        // Not during a call, use the existing localStream
        if (connectionStatus === 'connected') {
          console.log('[DeviceSettings] In call - creating separate preview stream')

          // Stop old preview stream if exists
          if (previewStreamRef.current) {
            console.log('[DeviceSettings] Stopping old preview stream')
            previewStreamRef.current.getTracks().forEach(track => track.stop())
          }

          const constraints: MediaStreamConstraints = {
            video: selectedVideoDevice ? { deviceId: selectedVideoDevice } : true,
            audio: false // No audio needed for preview
          }

          console.log('[DeviceSettings] Getting user media with constraints:', constraints)
          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          console.log('[DeviceSettings] Preview stream created, tracks:', stream.getTracks().length)
          stream.getVideoTracks().forEach((track, idx) => {
            console.log(`[DeviceSettings] Preview track ${idx}: id=${track.id}, label=${track.label}, enabled=${track.enabled}, readyState=${track.readyState}`)
          })

          previewStreamRef.current = stream
          setPreviewStream(stream)
        } else {
          console.log('[DeviceSettings] Not in call - creating preview stream for device settings')

          // Stop old preview stream if exists
          if (previewStreamRef.current) {
            console.log('[DeviceSettings] Stopping old preview stream')
            previewStreamRef.current.getTracks().forEach(track => track.stop())
          }

          const constraints: MediaStreamConstraints = {
            video: selectedVideoDevice ? { deviceId: selectedVideoDevice } : true,
            audio: false // No audio needed for preview
          }

          console.log('[DeviceSettings] Getting user media with constraints:', constraints)
          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          console.log('[DeviceSettings] Preview stream created, tracks:', stream.getTracks().length)

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
      console.log('[DeviceSettings] Attaching stream to video element, previewStream exists:', !!previewStream)
      if (previewStream && localVideoEnabled) {
        console.log('[DeviceSettings] Setting video srcObject')
        videoRef.current.srcObject = previewStream

        // Log when video starts playing
        const handlePlay = () => console.log('[DeviceSettings] Video element started playing')
        const handleError = (e: Event) => console.error('[DeviceSettings] Video element error:', e)

        videoRef.current.addEventListener('play', handlePlay)
        videoRef.current.addEventListener('error', handleError)

        return () => {
          videoRef.current?.removeEventListener('play', handlePlay)
          videoRef.current?.removeEventListener('error', handleError)
        }
      } else {
        console.log('[DeviceSettings] Clearing video srcObject')
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
    console.log('[DeviceSettings] Video device change requested:', deviceId)

    if (deviceId === 'disabled') {
      console.log('[DeviceSettings] Disabling video')
      setLocalVideoEnabled(false)
    } else {
      console.log('[DeviceSettings] Enabling video and changing device')
      setLocalVideoEnabled(true)
      await videoDevices.handleDeviceChange(deviceId)

      // If in a call, update the preview stream with the new device
      if (connectionStatus === 'connected') {
        console.log('[DeviceSettings] Updating preview stream with new device')
        try {
          // Stop old preview stream
          if (previewStreamRef.current) {
            console.log('[DeviceSettings] Stopping old preview stream before device change')
            previewStreamRef.current.getTracks().forEach(track => track.stop())
          }

          const constraints: MediaStreamConstraints = {
            video: { deviceId },
            audio: false
          }

          console.log('[DeviceSettings] Creating new preview stream with constraints:', constraints)
          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          console.log('[DeviceSettings] New preview stream created')

          previewStreamRef.current = stream
          setPreviewStream(stream)
        } catch (err) {
          console.error('[DeviceSettings] Error updating preview stream:', err)
        }
      }
    }
  }

  const handleAudioDeviceChange = async (deviceId: string) => {
    console.log('[DeviceSettings] Audio device change requested:', deviceId)

    if (deviceId === 'disabled') {
      console.log('[DeviceSettings] Disabling audio')
      setLocalAudioEnabled(false)
    } else {
      console.log('[DeviceSettings] Enabling audio and changing device')
      setLocalAudioEnabled(true)
      await audioDevices.handleDeviceChange(deviceId)
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
