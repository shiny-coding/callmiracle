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
    if (!device.deviceId) {
      return `Camera (no ID)`
    }

    // CRITICAL: Do NOT create test streams!
    // This component is used during ACTIVE calls. On iOS, creating a test stream
    // will kill the active call stream because iOS only allows one camera stream.
    // Instead, use the device label if available, or provide a generic label.

    if (device.label) {
      const labelLower = device.label.toLowerCase()
      if (labelLower.includes('front') || labelLower.includes('user')) {
        return 'Front Camera'
      }
      if (labelLower.includes('back') || labelLower.includes('rear') || labelLower.includes('environment')) {
        return 'Back Camera'
      }
      return device.label
    }

    // No label available - return generic label
    return `Camera ${device.deviceId.slice(0, 5)}...`
  } catch (err) {
    // Return fallback label on error
    return device.label || `Camera ${device.deviceId?.slice(0, 5) || 'Unknown'}...`
  }
}

interface LocalVideoProps {
  onClose?: () => void
  showDeviceSelection?: boolean
  compact?: boolean
}

export default function LocalVideo({ onClose, showDeviceSelection = true, compact = false }: LocalVideoProps) {
  const t = useTranslations()
  const { localVideoEnabled, localAudioEnabled, connectionStatus } = useStore((state) => ({
    localVideoEnabled: state.localVideoEnabled,
    localAudioEnabled: state.localAudioEnabled,
    connectionStatus: state.connectionStatus
  }))
  const { localStream } = useWebRTCContext()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string>('')
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(4 / 3) // Default 4:3

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
        console.log('[LocalVideo] Attaching local stream to video element', {
          streamId: localStream.id,
          trackCount: localStream.getTracks().length,
          tracks: localStream.getTracks().map(t => ({
            kind: t.kind,
            id: t.id,
            readyState: t.readyState,
            enabled: t.enabled
          }))
        })

        videoRef.current.srcObject = localStream
        setError('')

        // CRITICAL: On iOS Safari, videos sometimes need explicit play() call
        // even with autoPlay attribute
        const tryPlay = (isRetry = false) => {
          videoRef.current?.play().then(() => {
            console.log('[LocalVideo] Local video playing successfully')
          }).catch(err => {
            if (isRetry) {
              console.error('[LocalVideo] Retry play failed', { error: err })
            } else {
              // First failure is common on some browsers; retry quietly
              setTimeout(() => tryPlay(true), 150)
            }
          })
        }

        tryPlay(false)
      } else {
        videoRef.current.srcObject = null
        if (!localStream) {
          setError('Error accessing camera/microphone')
        }
      }
    }
  }, [localStream, localVideoEnabled])

  // Update aspect ratio when video metadata loads
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        const aspectRatio = video.videoWidth / video.videoHeight
        console.log('[LocalVideo] Video dimensions:', video.videoWidth, 'x', video.videoHeight, 'aspect ratio:', aspectRatio)
        setVideoAspectRatio(aspectRatio)
      }
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)

    // Check if metadata already loaded
    if (video.videoWidth && video.videoHeight) {
      handleLoadedMetadata()
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [localStream])

  const containerStyle = compact
    ? { width: '100%', height: '100%' }
    : connectionStatus === 'connected'
    ? {
        height: '150px',
        width: `${150 * videoAspectRatio}px`
      }
    : {
        height: '300px',
        width: `${300 * videoAspectRatio}px`
      }

  return (
    <div className={`relative ${compact ? 'w-full h-full' : connectionStatus === 'connected' ? '' : 'w-full max-w-[400px] mx-auto'}`}>
      {error && !compact && (
        <div className="bg-red-50 dark:bg-red-900/50 p-4 rounded-lg text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>
      )}
      <div style={containerStyle}
        className={`relative ${compact ? '' : connectionStatus === 'connected' ? 'rounded-lg ' : 'rounded-lg  mx-auto'}`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full ${compact ? 'object-contain' : 'object-contain'} ${compact ? '' : 'rounded-lg'} ${!localVideoEnabled ? 'opacity-0 pointer-events-none absolute' : ''}`}
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
      {showDeviceSelection && connectionStatus !== 'connected' && (
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
