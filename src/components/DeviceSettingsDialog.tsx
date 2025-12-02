'use client'

import { useTranslations } from 'next-intl'
import { useDeviceSelection } from '@/hooks/useDeviceSelection'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useMediaPermissions } from '@/hooks/useMediaPermissions'
import { useEffect, useRef, useState, useCallback } from 'react'
import { IconButton, Button, Dialog, DialogTitle, DialogContent } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

// Clean up device name by removing hardware IDs like (046d:082d)
function cleanDeviceName(name: string): string {
  // Remove patterns like (046d:082d) or similar hardware identifiers
  return name.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim()
}

async function getVideoDeviceLabel(device: MediaDeviceInfo): Promise<string | null> {
  try {
    console.log('[getVideoDeviceLabel] Processing device', {
      deviceId: device.deviceId?.slice(0, 10),
      label: device.label,
      kind: device.kind
    })

    if (!device.deviceId) {
      console.log('[getVideoDeviceLabel] No deviceId, returning fallback')
      return `Camera (no ID)`
    }

    // If device already has a label from permissions, use it to determine camera type
    if (device.label) {
      const labelLower = device.label.toLowerCase()
      if (labelLower.includes('front') || labelLower.includes('user')) {
        console.log('[getVideoDeviceLabel] Detected front camera')
        return 'Front Camera'
      }
      if (labelLower.includes('back') || labelLower.includes('rear') || labelLower.includes('environment')) {
        console.log('[getVideoDeviceLabel] Detected back camera')
        return 'Back Camera'
      }

      // Return the label as-is if it doesn't match known patterns
      console.log('[getVideoDeviceLabel] Using original label', { label: device.label })
      return device.label
    }

    // Don't create test streams - causes issues on iOS
    // Just return a generic label
    const genericLabel = `Camera ${device.deviceId.slice(0, 5)}...`
    console.log('[getVideoDeviceLabel] No label, using generic', { label: genericLabel })
    return genericLabel
  } catch (err) {
    // Even on error, return a fallback label so the device isn't filtered out
    const fallbackLabel = device.label || `Camera ${device.deviceId?.slice(0, 5) || 'Unknown'}...`
    console.error('[getVideoDeviceLabel] Error processing device, using fallback', {
      fallbackLabel,
      error: err instanceof Error ? err.message : String(err)
    })
    return fallbackLabel
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
  const { localStream, setLocalStream, connectionStatus, sendWantedMediaState, caller, callee } = useWebRTCContext()
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
      // CRITICAL: On iOS, do NOT request permissions during an active call!
      // iOS can only have one camera stream. Requesting permissions creates a test stream
      // which can conflict with the active call stream, causing the video to freeze.
      // This also prevents the double permission prompt issue on iOS.
      const isInCall = ['receiving-call', 'calling', 'connecting', 'connected'].includes(connectionStatus)

      if (isIOS && isInCall) {
        console.log('[DeviceSettings] iOS in call - skipping permission request to avoid camera conflict', {
          connectionStatus,
          permissionsState: permissions
        })
        return
      }

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
  }, [open, permissions, requestPermissions, connectionStatus, isIOS])

  // Memoize getLabel to prevent unnecessary re-enumeration of devices
  // Note: We don't include previewStream in dependencies because we don't actually use it
  // in getVideoDeviceLabel, and including it would cause unnecessary re-enumeration
  const getVideoLabel = useCallback((device: MediaDeviceInfo) => {
    return getVideoDeviceLabel(device)
  }, [])

  const videoDevices = useDeviceSelection({
    kind: 'videoinput',
    storageKey: 'selectedVideoDevice',
    isEnabled: localVideoEnabled,
    getLabel: getVideoLabel
  })

  const audioDevices = useDeviceSelection({
    kind: 'audioinput',
    storageKey: 'selectedAudioDevice',
    isEnabled: localAudioEnabled
  })

  // Debug logging for device lists
  useEffect(() => {
    console.log('[DeviceSettings] Video devices updated', {
      count: videoDevices.devices.length,
      devices: videoDevices.devices.map(d => ({
        id: d.deviceId.slice(0, 10),
        label: videoDevices.deviceLabels[d.deviceId] || d.label
      })),
      selectedDevice: videoDevices.selectedDevice,
      localVideoEnabled
    })
  }, [videoDevices.devices, videoDevices.deviceLabels, videoDevices.selectedDevice, localVideoEnabled])

  useEffect(() => {
    console.log('[DeviceSettings] Audio devices updated', {
      count: audioDevices.devices.length,
      devices: audioDevices.devices.map(d => d.label),
      selectedDevice: audioDevices.selectedDevice,
      localAudioEnabled
    })
  }, [audioDevices.devices, audioDevices.selectedDevice, localAudioEnabled])

  // Cleanup preview stream immediately when dialog closes
  useEffect(() => {
    if (!open) {
      const isInCall = ['receiving-call', 'calling', 'connecting', 'connected'].includes(connectionStatus)

      console.log('[DeviceSettings] Dialog closed, starting cleanup', {
        hasPreviewStream: !!previewStreamRef.current,
        trackCount: previewStreamRef.current?.getTracks().length || 0,
        connectionStatus,
        isInCall,
        isIOS,
        previewIsLocalStream: previewStreamRef.current === localStream
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

        // CRITICAL: On iOS during ANY call state, previewStreamRef points to localStream
        // We must NOT stop those tracks or the call will end!
        const shouldStopTracks = !(isIOS && isInCall && previewStreamRef.current === localStream)

        if (previewStreamRef.current) {
          if (shouldStopTracks) {
            // Safe to stop - this is a separate preview stream
            const tracks = previewStreamRef.current.getTracks()
            tracks.forEach(track => {
              console.log('[DeviceSettings] Stopping preview track on dialog close', {
                trackId: track.id,
                kind: track.kind,
                label: track.label,
                readyState: track.readyState
              })
              track.stop()
            })
          } else {
            // Do NOT stop - this is the active call stream on iOS
            console.log('[DeviceSettings] NOT stopping tracks - this is the active call stream on iOS', {
              connectionStatus,
              streamId: previewStreamRef.current.id,
              trackCount: previewStreamRef.current.getTracks().length
            })
          }
          previewStreamRef.current = null
        }
        setPreviewStream(null)
      }

      cleanup()
      console.log('[DeviceSettings] Cleanup completed on dialog close')
      return
    } else {
      console.log('[DeviceSettings] Dialog opened', {
        localVideoEnabled,
        connectionStatus
      })
    }

    async function createPreviewStream() {
      // Prevent concurrent stream creation
      if (isCreatingStreamRef.current) {
        console.log('[DeviceSettings] Skipping createPreviewStream - already creating', {
          currentFlag: isCreatingStreamRef.current
        })
        return
      }

      if (!localVideoEnabled) {
        console.log('[DeviceSettings] Video disabled, cleaning up preview stream')
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
      console.log('[DeviceSettings] Setting isCreatingStreamRef to true in createPreviewStream')
      try {
        const selectedVideoDevice = localStorage.getItem('selectedVideoDevice') || ''
        console.log('[DeviceSettings] Creating preview stream', {
          selectedVideoDevice: selectedVideoDevice.slice(0, 20) + '...',
          connectionStatus,
          hasOldStream: !!previewStreamRef.current,
          flagState: isCreatingStreamRef.current,
          isIOS,
          currentFacingMode
        })

        // During a call, create a separate preview stream
        // Not during a call, use the existing localStream

        // On iOS, check if we're in ANY call-related state
        const isInCall = ['receiving-call', 'calling', 'connecting', 'connected'].includes(connectionStatus)

        if (isInCall && isIOS) {
          // On iOS, CRITICAL: Cannot create a new stream during ANY call state!
          // iOS Safari only allows ONE active camera stream at a time.
          // Creating a new stream will end the active call stream.
          // IMPORTANT: Even if localStream doesn't exist yet (call not accepted),
          // we must NOT create a preview stream, as it will conflict with the
          // stream that will be created when user accepts the call.
          console.log('[DeviceSettings] iOS in call state - no preview stream during call', {
            connectionStatus,
            hasLocalStream: !!localStream,
            localStreamId: localStream?.id,
            trackCount: localStream?.getTracks().length || 0
          })

          // If localStream exists, use it for preview
          if (localStream) {
            previewStreamRef.current = localStream
            setPreviewStream(localStream)
          } else {
            // No localStream yet (call not accepted) - don't create preview
            previewStreamRef.current = null
            setPreviewStream(null)
          }
        } else if (isInCall && !isIOS) {
          // Non-iOS during call: Create separate preview stream
          if (connectionStatus === 'connected') {
            // Non-iOS: Can safely create separate preview stream
            // Clear video element srcObject first
            if (videoRef.current) {
              videoRef.current.srcObject = null
            }

            // Stop old preview stream if exists
            if (previewStreamRef.current) {
              previewStreamRef.current.getTracks().forEach(track => track.stop())
            }

            const constraints: MediaStreamConstraints = {
              video: selectedVideoDevice ? { deviceId: selectedVideoDevice } : true,
              audio: false // No audio needed for preview
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            const tracks = stream.getVideoTracks()

            console.log('[DeviceSettings] Preview stream created (connected, non-iOS)', {
              streamId: stream.id,
              trackCount: tracks.length,
              trackLabel: tracks[0]?.label,
              trackId: tracks[0]?.id
            })

            previewStreamRef.current = stream
            setPreviewStream(stream)
          }
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

          console.log('[DeviceSettings] Preview stream created (not connected)', {
            streamId: stream.id,
            trackCount: tracks.length,
            trackLabel: tracks[0]?.label,
            trackId: tracks[0]?.id
          })

          previewStreamRef.current = stream
          setPreviewStream(stream)
        }
      } catch (err) {
        console.error('[DeviceSettings] Error creating preview stream', {
          error: err instanceof Error ? err.message : String(err)
        })
        setPreviewStream(null)
      } finally {
        console.log('[DeviceSettings] Resetting isCreatingStreamRef to false in createPreviewStream finally')
        isCreatingStreamRef.current = false
      }
    }

    createPreviewStream()

    // Cleanup function that runs when effect dependencies change or component unmounts
    return () => {
      const isInCall = ['receiving-call', 'calling', 'connecting', 'connected'].includes(connectionStatus)
      const isActiveCallOnIOS = isIOS && isInCall

      console.log('[DeviceSettings] useEffect cleanup running', {
        hasPreviewStream: !!previewStreamRef.current,
        trackCount: previewStreamRef.current?.getTracks().length || 0,
        flagState: isCreatingStreamRef.current,
        connectionStatus,
        isInCall,
        isActiveCallOnIOS
      })

      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.srcObject = null
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
      }

      // CRITICAL: On iOS during ANY call state, NEVER stop tracks!
      // The preview stream will either be:
      // 1. The current localStream (active call stream), OR
      // 2. A new stream we're switching to (which will become localStream)
      // In both cases, stopping tracks would kill the call stream.
      if (previewStreamRef.current) {
        if (isActiveCallOnIOS) {
          console.log('[DeviceSettings] NOT stopping tracks in useEffect cleanup - active call on iOS', {
            connectionStatus,
            streamId: previewStreamRef.current.id,
            trackCount: previewStreamRef.current.getTracks().length
          })
        } else {
          const tracks = previewStreamRef.current.getTracks()
          tracks.forEach(track => {
            console.log('[DeviceSettings] Stopping track in useEffect cleanup', {
              trackId: track.id,
              kind: track.kind,
              label: track.label,
              readyState: track.readyState
            })
            track.stop()
          })
        }
        previewStreamRef.current = null
      }
    }
  }, [open, localStream, localVideoEnabled, connectionStatus, isIOS])

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
    const isInCall = ['receiving-call', 'calling', 'connecting', 'connected'].includes(connectionStatus)
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user'

    console.log('[DeviceSettings] iOS camera toggle requested', {
      currentFacingMode,
      newFacingMode,
      connectionStatus,
      isInCall
    })

    try {
      // Get new stream with new facingMode
      const constraints: MediaStreamConstraints = {
        video: { facingMode: newFacingMode },
        audio: false
      }

      console.log('[DeviceSettings] Requesting new stream with facingMode', { facingMode: newFacingMode })
      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      const newVideoTrack = newStream.getVideoTracks()[0]

      console.log('[DeviceSettings] New iOS camera stream acquired', {
        streamId: newStream.id,
        trackId: newVideoTrack.id,
        trackLabel: newVideoTrack.label,
        facingMode: newFacingMode
      })

      if (isInCall && localStream) {
        // During a call: Create new stream and update localStream
        // The WebRTCProvider will automatically replace tracks in the peer connection
        console.log('[DeviceSettings] In call - creating new local stream with new camera')

        // Get old video track to stop it later
        const oldVideoTrack = localStream.getVideoTracks()[0]

        // Create new MediaStream with new video track + existing audio track
        const audioTrack = localStream.getAudioTracks()[0]
        const newLocalStream = new MediaStream()
        newLocalStream.addTrack(newVideoTrack)
        if (audioTrack) {
          newLocalStream.addTrack(audioTrack)
        }

        console.log('[DeviceSettings] Created new local stream', {
          streamId: newLocalStream.id,
          trackCount: newLocalStream.getTracks().length,
          tracks: newLocalStream.getTracks().map(t => ({
            kind: t.kind,
            id: t.id,
            label: t.label
          }))
        })

        // Update the local stream - WebRTCProvider will handle track replacement
        setLocalStream(newLocalStream)

        // Stop the old video track
        if (oldVideoTrack) {
          oldVideoTrack.stop()
          console.log('[DeviceSettings] Old video track stopped', {
            trackId: oldVideoTrack.id
          })
        }

        // Update preview
        previewStreamRef.current = newLocalStream
        setPreviewStream(newLocalStream)
      } else {
        // Not in a call: Just replace the preview stream
        console.log('[DeviceSettings] Not in call - replacing preview stream only')

        // Stop current preview stream
        if (previewStreamRef.current) {
          const tracks = previewStreamRef.current.getTracks()
          tracks.forEach(track => {
            console.log('[DeviceSettings] Stopping preview track for iOS camera toggle', {
              trackId: track.id,
              readyState: track.readyState
            })
            track.stop()
          })
        }

        // Clear video element
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.srcObject = null
          videoRef.current.removeAttribute('src')
          videoRef.current.load()
        }

        // Wait for iOS to release camera hardware
        console.log('[DeviceSettings] Waiting 100ms for iOS camera release')
        await new Promise(resolve => setTimeout(resolve, 100))

        // Update preview
        previewStreamRef.current = newStream
        setPreviewStream(newStream)
      }

      // Update facingMode
      setCurrentFacingMode(newFacingMode)
      localStorage.setItem('selectedVideoDevice', newFacingMode === 'user' ? 'front' : 'back')

      console.log('[DeviceSettings] Camera toggle completed successfully', {
        newFacingMode,
        isInCall
      })
    } catch (err) {
      console.error('[DeviceSettings] Error toggling iOS camera', {
        error: err instanceof Error ? err.message : String(err),
        attemptedFacingMode: newFacingMode,
        isInCall
      })
    }
  }

  const handleVideoDeviceChange = async (deviceId: string) => {
    console.log('[DeviceSettings] handleVideoDeviceChange called', { deviceId })
    if (deviceId === 'disabled') {
      console.log('[DeviceSettings] Disabling video, saving to localStorage')
      setLocalVideoEnabled(false)
      // Save explicit disabled state to localStorage
      localStorage.setItem('selectedVideoDevice', 'disabled')
      console.log('[DeviceSettings] localStorage updated', {
        selectedVideoDevice: localStorage.getItem('selectedVideoDevice')
      })
      // Notify peer if in a call
      if (connectionStatus === 'connected') {
        sendWantedMediaState()
      }
    } else {
      // On iOS, we don't use deviceId-based switching, only facingMode toggle
      if (isIOS) {
        console.log('[DeviceSettings] iOS detected - ignoring deviceId-based switch, use facingMode toggle instead')
        setLocalVideoEnabled(true)
        return
      }

      // Non-iOS: Standard deviceId-based switching
      console.log('[DeviceSettings] Enabling video and changing device', {
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
      // Save explicit disabled state to localStorage
      localStorage.setItem('selectedAudioDevice', 'disabled')
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
    const isInCall = ['receiving-call', 'calling', 'connecting', 'connected'].includes(connectionStatus)
    const previewIsLocalStream = previewStreamRef.current === localStream

    console.log('[DeviceSettings] handleClose called', {
      hasPreviewStream: !!previewStreamRef.current,
      trackCount: previewStreamRef.current?.getTracks().length || 0,
      isIOS,
      isInCall,
      previewIsLocalStream
    })

    // CRITICAL: On iOS during a call, previewStreamRef points to localStream (the active call stream)
    // We must NOT stop those tracks or the call will end!
    const shouldStopTracks = !(isIOS && isInCall && previewIsLocalStream)

    if (previewStreamRef.current) {
      if (shouldStopTracks) {
        const tracks = previewStreamRef.current.getTracks()
        tracks.forEach(track => {
          console.log('[DeviceSettings] Stopping track in handleClose', {
            trackId: track.id,
            kind: track.kind,
            readyState: track.readyState
          })
          track.stop()
        })
      } else {
        console.log('[DeviceSettings] NOT stopping tracks in handleClose - active call stream on iOS', {
          streamId: previewStreamRef.current.id,
          trackCount: previewStreamRef.current.getTracks().length
        })
      }
      previewStreamRef.current = null
    }
    setPreviewStream(null)

    // Clear video element
    if (videoRef.current) {
      console.log('[DeviceSettings] Clearing video element in handleClose')
      videoRef.current.pause()
      videoRef.current.srcObject = null
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }

    console.log('[DeviceSettings] handleClose completed, calling onClose')
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
              className="relative w-full h-full  rounded-lg overflow-hidden flex items-center justify-center"
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
              <div className="text-lg font-medium mb-2 text-color">
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
                {isIOS && (
                  <>
                    <Button
                      fullWidth
                      variant={localVideoEnabled && currentFacingMode === 'user' ? "contained" : "outlined"}
                      onClick={() => {
                        // Enable video if disabled
                        if (!localVideoEnabled) {
                          console.log('[DeviceSettings] Enabling front camera from disabled state')
                          setLocalVideoEnabled(true)
                          localStorage.setItem('selectedVideoDevice', 'front')
                          setCurrentFacingMode('user')
                          if (connectionStatus === 'connected') {
                            sendWantedMediaState()
                          }
                        } else if (currentFacingMode !== 'user') {
                          handleIOSCameraToggle()
                        }
                      }}
                      sx={{ justifyContent: 'flex-start !important', textAlign: 'left', px: 3 }}
                    >
                      {t('frontCamera') || 'Front Camera'}
                    </Button>
                    <Button
                      fullWidth
                      variant={localVideoEnabled && currentFacingMode === 'environment' ? "contained" : "outlined"}
                      onClick={() => {
                        // Enable video if disabled
                        if (!localVideoEnabled) {
                          console.log('[DeviceSettings] Enabling back camera from disabled state')
                          setLocalVideoEnabled(true)
                          localStorage.setItem('selectedVideoDevice', 'back')
                          setCurrentFacingMode('environment')
                          if (connectionStatus === 'connected') {
                            sendWantedMediaState()
                          }
                        } else if (currentFacingMode !== 'environment') {
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
              <div className="text-lg font-medium mb-2 text-color">
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
