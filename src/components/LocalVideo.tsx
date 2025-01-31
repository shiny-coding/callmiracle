'use client'

import { useEffect, useRef, useState } from 'react'
import { IconButton, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import { useTranslations } from 'next-intl'
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'

export default function LocalVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [error, setError] = useState<string>('')
  const t = useTranslations()
  const { name } = useStore()
  const { localStream, setLocalStream, localVideoEnabled, setLocalVideoEnabled, localAudioEnabled, setLocalAudioEnabled } = useWebRTCContext()
  const [devices, setDevices] = useState<{
    video: MediaDeviceInfo[],
    audio: MediaDeviceInfo[]
  }>({ video: [], audio: [] })
  const [selectedDevices, setSelectedDevices] = useState<{
    videoId: string,
    audioId: string
  }>({ videoId: '', audioId: '' })

  useEffect(() => {
    // Initialize client-side only states
    const savedCameraEnabled = localStorage.getItem('cameraEnabled')
    const savedAudioEnabled = localStorage.getItem('audioEnabled')
    if (savedCameraEnabled !== null) {
      setLocalVideoEnabled(savedCameraEnabled !== 'false')
    }
    if (savedAudioEnabled !== null) {
      setLocalAudioEnabled(savedAudioEnabled !== 'false')
    }
    
    setSelectedDevices({
      videoId: localStorage.getItem('selectedVideoDevice') || '',
      audioId: localStorage.getItem('selectedAudioDevice') || ''
    })
  }, [setLocalVideoEnabled, setLocalAudioEnabled])

  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setDevices({
          video: devices.filter(d => d.kind === 'videoinput'),
          audio: devices.filter(d => d.kind === 'audioinput')
        })
      } catch (err) {
        console.error('Error getting devices:', err)
      }
    }
    getDevices()
  }, [])

  useEffect(() => {
    async function setupStream() {
      try {
        if (!videoRef.current) {
          return
        }

        // Stop any existing tracks
        if (videoRef.current.srcObject instanceof MediaStream) {
          videoRef.current.srcObject.getTracks().forEach(track => track.stop())
          videoRef.current.srcObject = null
        }

        // Create new stream
        const constraints: MediaStreamConstraints = {}
        if (localVideoEnabled) {
          constraints.video = selectedDevices.videoId ? { deviceId: selectedDevices.videoId } : true
        }
        if (localAudioEnabled) {
          constraints.audio = selectedDevices.audioId ? { deviceId: selectedDevices.audioId } : true
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        
        // Set initial track states
        stream.getVideoTracks().forEach(track => {
          track.enabled = localVideoEnabled
        })
        stream.getAudioTracks().forEach(track => {
          track.enabled = localAudioEnabled
        })

        // Check again if video element is still available
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setHasPermission(true)
          setError('')
          setLocalStream(stream)
        } else {
          // Clean up if video element is gone
          stream.getTracks().forEach(track => track.stop())
          setLocalStream(undefined)
        }
      } catch (err) {
        console.error('Error accessing media devices:', err)
        setError('Error accessing camera/microphone')
        setHasPermission(false)
        setLocalStream(undefined)
      }
    }

    setupStream()
  }, [localVideoEnabled, localAudioEnabled, selectedDevices.videoId, selectedDevices.audioId, setLocalStream])

  const handleVideoToggle = () => {
    const newState = !localVideoEnabled
    setLocalVideoEnabled(newState)
    localStorage.setItem('cameraEnabled', String(newState))
  }

  const toggleAudio = () => {
    const newState = !localAudioEnabled
    setLocalAudioEnabled(newState)
    localStorage.setItem('audioEnabled', String(newState))
  }

  const handleDeviceChange = (type: 'video' | 'audio', deviceId: string) => {
    setSelectedDevices(prev => ({ ...prev, [`${type}Id`]: deviceId }))
    localStorage.setItem(`selected${type.charAt(0).toUpperCase() + type.slice(1)}Device`, deviceId)
  }

  return (
    <div className="relative w-full max-w-[200px] mx-auto mb-6">
      <div className="flex justify-between items-center mb-2">
        <Typography variant="subtitle1">{name || 'Me'}</Typography>
        <div className="flex gap-1">
          <IconButton 
            onClick={toggleAudio}
            className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            size="small"
          >
            {localAudioEnabled ? (
              <MicIcon className="text-blue-500" />
            ) : (
              <MicOffIcon className="text-gray-500" />
            )}
          </IconButton>
          <IconButton 
            onClick={handleVideoToggle}
            className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            size="small"
          >
            {localVideoEnabled ? (
              <VideocamIcon className="text-blue-500" />
            ) : (
              <VideocamOffIcon className="text-gray-500" />
            )}
          </IconButton>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 p-4 rounded-lg text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>
      )}
      <div style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }} className="mx-auto bg-gray-100 dark:bg-gray-800 rounded-lg">
        {localVideoEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain rounded-lg"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            {t('cameraDisabled')}
          </div>
        )}
      </div>
      {(devices.video.length > 0 || devices.audio.length > 0) && (
        <div className="flex gap-2 mt-2">
          {devices.video.length > 0 && (
            <FormControl size="small" fullWidth className="dark:bg-gray-800 rounded-lg">
              <InputLabel className="dark:text-gray-300">Camera</InputLabel>
              <Select
                value={selectedDevices.videoId}
                onChange={(e) => handleDeviceChange('video', e.target.value)}
                label="Camera"
                className="dark:text-gray-100"
              >
                {devices.video.map(device => (
                  <MenuItem key={device.deviceId} value={device.deviceId} className="dark:text-gray-100 dark:hover:bg-gray-700">
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {devices.audio.length > 0 && (
            <FormControl size="small" fullWidth className="dark:bg-gray-800 rounded-lg">
              <InputLabel className="dark:text-gray-300">Microphone</InputLabel>
              <Select
                value={selectedDevices.audioId}
                onChange={(e) => handleDeviceChange('audio', e.target.value)}
                label="Microphone"
                className="dark:text-gray-100"
              >
                {devices.audio.map(device => (
                  <MenuItem key={device.deviceId} value={device.deviceId} className="dark:text-gray-100 dark:hover:bg-gray-700">
                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </div>
      )}
    </div>
  )
}