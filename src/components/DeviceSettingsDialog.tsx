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
  const { localStream } = useWebRTCContext()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLandscape, setIsLandscape] = useState(true)

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

  // Attach localStream to video element
  useEffect(() => {
    if (videoRef.current && open) {
      if (localStream && localVideoEnabled) {
        videoRef.current.srcObject = localStream
      } else {
        videoRef.current.srcObject = null
      }
    }
  }, [localStream, localVideoEnabled, open])

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

  const handleVideoDeviceChange = (deviceId: string) => {
    if (deviceId === 'disabled') {
      setLocalVideoEnabled(false)
    } else {
      setLocalVideoEnabled(true)
      videoDevices.handleDeviceChange(deviceId)
    }
  }

  const handleAudioDeviceChange = (deviceId: string) => {
    if (deviceId === 'disabled') {
      setLocalAudioEnabled(false)
    } else {
      setLocalAudioEnabled(true)
      audioDevices.handleDeviceChange(deviceId)
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
      <DialogContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
        <div
          ref={containerRef}
          className={`flex ${isLandscape ? 'flex-row' : 'flex-col'} gap-4 flex-1 min-h-0`}
        >
          {/* Video preview section */}
          <div className={`${isLandscape ? 'w-1/2' : 'flex-1'} flex items-center justify-center min-h-0`}>
            <div className="relative w-full h-full bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
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
          <div className={`${isLandscape ? 'w-1/2' : 'flex-1'} flex flex-col gap-4 overflow-y-auto min-h-0`}>
            {/* Video devices */}
            <div>
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
            <div>
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
