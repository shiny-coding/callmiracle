'use client'

import { useEffect, useRef, useState } from 'react'
import { IconButton, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import { useTranslations } from 'next-intl'
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video'

interface VideoPreviewProps {
  onStreamChange: (stream: MediaStream | undefined) => void
}

export default function VideoPreview({ onStreamChange }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [error, setError] = useState<string>('')
  const [isEnabled, setIsEnabled] = useState(true)
  const t = useTranslations()
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
    if (savedCameraEnabled !== null) {
      setIsEnabled(savedCameraEnabled !== 'false')
    }
    
    setSelectedDevices({
      videoId: localStorage.getItem('selectedVideoDevice') || '',
      audioId: localStorage.getItem('selectedAudioDevice') || ''
    })
  }, [])

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
        if (!isEnabled) {
          if (videoRef.current?.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
            tracks.forEach(track => track.stop())
            videoRef.current.srcObject = null
            onStreamChange(undefined)
          }
          return
        }

        const constraints: MediaStreamConstraints = {
          video: selectedDevices.videoId ? { deviceId: selectedDevices.videoId } : true,
          audio: selectedDevices.audioId ? { deviceId: selectedDevices.audioId } : true
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setHasPermission(true)
          setError('')
          onStreamChange(stream)
        }
      } catch (err) {
        console.error('Error accessing media devices:', err)
        setError('Error accessing camera/microphone')
        setHasPermission(false)
        onStreamChange(undefined)
      }
    }

    setupStream()
  }, [isEnabled, selectedDevices.videoId, selectedDevices.audioId, onStreamChange])

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