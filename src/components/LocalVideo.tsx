'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useDeviceSelection } from '@/hooks/useDeviceSelection'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'

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

interface LocalVideoProps {
  onClose?: () => void
}

export default function LocalVideo({ onClose }: LocalVideoProps) {
  const t = useTranslations()
  const { localVideoEnabled, localAudioEnabled, connectionStatus } = useStore((state) => ({
    localVideoEnabled: state.localVideoEnabled,
    localAudioEnabled: state.localAudioEnabled,
    connectionStatus: state.connectionStatus
  }))
  const { localStream } = useWebRTCContext()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string>('')

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
        setError('')
      } else {
        videoRef.current.srcObject = null
        if (!localStream) {
          setError('Error accessing camera/microphone')
        }
      }
    }
  }, [localStream, localVideoEnabled])

  return (
    <div className="relative w-full max-w-[400px] mx-auto">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 p-4 rounded-lg text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>
      )}
      <div style={connectionStatus === 'connected' ? { width: '200px', height: '150px' } : { width: '400px', height: '300px' }}
        className="relative mx-auto bg-gray-800 rounded-lg">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain rounded-lg ${!localVideoEnabled ? 'opacity-0 pointer-events-none absolute' : ''}`}
        />
        {!localVideoEnabled && (
          <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            {t('cameraDisabled')}
          </div>
        )}
        {/* Close button */}
        {onClose && (
          <div className="absolute top-2 right-2">
            <IconButton
              onClick={onClose}
              size="small"
              aria-label={t('close')}
              title={t('close')}
              className="bg-black/50 hover:bg-black/70 text-white"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>
        )}
      </div>

      {/* Device selection */}
      {connectionStatus !== 'connected' && (
        <div className="mt-4 space-y-3">
          {/* Video devices */}
          {videoDevices.devices.length > 0 && (
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {t('camera')}
              </div>
              <div className="flex flex-col gap-1">
                {videoDevices.devices.map(device => (
                  <button
                    key={device.deviceId}
                    onClick={() => videoDevices.handleDeviceChange(device.deviceId)}
                    className={`
                      px-3 py-2 rounded text-sm text-left transition-colors
                      ${videoDevices.selectedDevice === device.deviceId
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
          )}

          {/* Audio devices */}
          {audioDevices.devices.length > 0 && (
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {t('microphone')}
              </div>
              <div className="flex flex-col gap-1">
                {audioDevices.devices.map(device => (
                  <button
                    key={device.deviceId}
                    onClick={() => audioDevices.handleDeviceChange(device.deviceId)}
                    className={`
                      px-3 py-2 rounded text-sm text-left transition-colors
                      ${audioDevices.selectedDevice === device.deviceId
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
          )}
        </div>
      )}
    </div>
  )
}