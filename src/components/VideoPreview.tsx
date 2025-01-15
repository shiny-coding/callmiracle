'use client'

import { useEffect, useRef, useState } from 'react'
import { IconButton, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import { useTranslations } from 'next-intl'

const VIDEO_WIDTH = 320
const VIDEO_HEIGHT = 240

export default function VideoPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [error, setError] = useState<string>('')
  const [isEnabled, setIsEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cameraEnabled') !== 'false'
    }
    return true
  })
  const t = useTranslations()
  const [devices, setDevices] = useState<{
    video: MediaDeviceInfo[],
    audio: MediaDeviceInfo[]
  }>({ video: [], audio: [] })
  const [selectedDevices, setSelectedDevices] = useState<{
    videoId: string,
    audioId: string
  }>(() => ({
    videoId: localStorage.getItem('selectedVideoDevice') || '',
    audioId: localStorage.getItem('selectedAudioDevice') || ''
  }))

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
    async function setupVideo() {
      try {
        if (!isEnabled) {
          if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream
            stream.getTracks().forEach(track => track.stop())
            videoRef.current.srcObject = null
          }
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: selectedDevices.videoId ? { deviceId: selectedDevices.videoId } : true,
          audio: selectedDevices.audioId ? { deviceId: selectedDevices.audioId } : true
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setHasPermission(true)
          setError('')
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          try {
            // Request initial permissions with default devices
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            tempStream.getTracks().forEach(track => track.stop())
            // Try again with selected devices
            setupVideo()
          } catch (permErr) {
            setError('Please allow camera access to use this app')
          }
        } else {
          setError('This camera is not available')
          console.error('Error accessing media devices:', err)
        }
      }
    }

    setupVideo()
    
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [isEnabled, selectedDevices.videoId, selectedDevices.audioId])

  const toggleCamera = () => {
    const newState = !isEnabled
    setIsEnabled(newState)
    localStorage.setItem('cameraEnabled', String(newState))
  }

  const handleDeviceChange = (type: 'video' | 'audio', deviceId: string) => {
    setSelectedDevices(prev => ({ ...prev, [`${type}Id`]: deviceId }))
    localStorage.setItem(`selected${type.charAt(0).toUpperCase() + type.slice(1)}Device`, deviceId)
  }

  return (
    <div className="relative w-full max-w-[320px] mx-auto mb-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 p-4 rounded-lg text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>
      )}
      <div style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }} className="mx-auto">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }}
          className={`rounded-lg shadow-lg object-cover ${!isEnabled && 'hidden'}`}
        />
        {!isEnabled && (
          <div 
            style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }}
            className="bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400"
          >
            {t('cameraDisabled')}
          </div>
        )}
      </div>
      <div className="flex justify-center mt-3">
        <IconButton 
          onClick={toggleCamera}
          className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
          size="small"
        >
          {isEnabled ? (
            <VideocamOffIcon className="text-blue-400" />
          ) : (
            <VideocamIcon className="text-blue-400" />
          )}
        </IconButton>
      </div>
      <div className="flex gap-2 mt-2">
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
      </div>
    </div>
  )
} 