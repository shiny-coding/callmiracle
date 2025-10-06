'use client'

import { Dialog, DialogContent, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslations } from 'next-intl'
import { useDeviceSelection } from '@/hooks/useDeviceSelection'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useEffect, useRef, useState } from 'react'

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

interface DeviceConfigurationProps {
  open: boolean
  onClose: () => void
}

export default function DeviceConfiguration({ open, onClose }: DeviceConfigurationProps) {
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
    if (videoRef.current) {
      if (localStream && localVideoEnabled) {
        videoRef.current.srcObject = localStream
      } else {
        videoRef.current.srcObject = null
      }
    }
  }, [localStream, localVideoEnabled])

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
  }, [open])

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
      fullScreen
      PaperProps={{
        className: 'normal-bg'
      }}
    >
      <div className="flex flex-col h-full normal-bg relative">
        {/* Header with close button */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold dark:text-gray-100">{t('deviceSettings')}</h2>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label={t('close')}
            title={t('close')}
          >
            <CloseIcon />
          </IconButton>
        </div>

        {/* Content container */}
        <div
          ref={containerRef}
          className={`flex-1 flex ${isLandscape ? 'flex-row' : 'flex-col'} gap-4 p-6 overflow-hidden`}
        >
          {/* Video preview section */}
          <div className={`${isLandscape ? 'w-1/2' : 'h-1/2'} flex items-center justify-center`}>
            <div className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain ${!localVideoEnabled ? 'opacity-0 pointer-events-none absolute' : ''}`}
              />
              {!localVideoEnabled && (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  {t('cameraDisabled')}
                </div>
              )}
            </div>
          </div>

          {/* Device selection section */}
          <div className={`${isLandscape ? 'w-1/2' : 'h-1/2'} flex flex-col gap-4 overflow-y-auto`}>
            {/* Video devices */}
            <div>
              <div className="text-lg font-medium mb-2 dark:text-gray-100">
                {t('camera')}
              </div>
              <div className="flex flex-col gap-2">
                {/* Disabled option */}
                <button
                  onClick={() => handleVideoDeviceChange('disabled')}
                  className={`
                    px-4 py-3 rounded text-sm text-left transition-colors
                    ${!localVideoEnabled
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {t('cameraDisabled')}
                </button>

                {/* Available devices */}
                {videoDevices.devices.map(device => (
                  <button
                    key={device.deviceId}
                    onClick={() => handleVideoDeviceChange(device.deviceId)}
                    className={`
                      px-4 py-3 rounded text-sm text-left transition-colors
                      ${localVideoEnabled && videoDevices.selectedDevice === device.deviceId
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    {videoDevices.deviceLabels[device.deviceId] || device.label || `Device ${device.deviceId.slice(0, 5)}...`}
                  </button>
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
                <button
                  onClick={() => handleAudioDeviceChange('disabled')}
                  className={`
                    px-4 py-3 rounded text-sm text-left transition-colors
                    ${!localAudioEnabled
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {t('microphoneDisabled')}
                </button>

                {/* Available devices */}
                {audioDevices.devices.map(device => (
                  <button
                    key={device.deviceId}
                    onClick={() => handleAudioDeviceChange(device.deviceId)}
                    className={`
                      px-4 py-3 rounded text-sm text-left transition-colors
                      ${localAudioEnabled && audioDevices.selectedDevice === device.deviceId
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    {device.label || `Device ${device.deviceId.slice(0, 5)}...`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
