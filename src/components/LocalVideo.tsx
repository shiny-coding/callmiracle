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
  const { 
    localStream, 
    setLocalStream, 
    localVideoEnabled, 
    setLocalVideoEnabled, 
    localAudioEnabled, 
    setLocalAudioEnabled,
    connectionStatus
  } = useWebRTCContext()
  const [devices, setDevices] = useState<{
    video: MediaDeviceInfo[],
    audio: MediaDeviceInfo[]
  }>({ video: [], audio: [] })
  const [selectedDevices, setSelectedDevices] = useState<{
    videoId: string,
    audioId: string
  }>({ videoId: '', audioId: '' })

  // Update video element when stream changes
  useEffect(() => {
    if (!videoRef.current) return

    // Update video source with new stream
    if (localStream && localVideoEnabled) {
      videoRef.current.srcObject = localStream
      setHasPermission(true)
      setError('')
    } else {
      if (videoRef.current.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop())
      }
      videoRef.current.srcObject = null
    }
  }, [localStream, localVideoEnabled])

  // Initialize client-side only states
  useEffect(() => {
    const savedCameraEnabled = localStorage.getItem('cameraEnabled')
    const savedAudioEnabled = localStorage.getItem('audioEnabled')
    if (savedCameraEnabled !== null) {
      setLocalVideoEnabled(savedCameraEnabled !== 'false')
    }
    if (savedAudioEnabled !== null) {
      setLocalAudioEnabled(savedAudioEnabled !== 'false')
    }
  }, [setLocalVideoEnabled, setLocalAudioEnabled])

  // Initial stream setup
  useEffect(() => {
    async function setupStream() {
      try {
        if (!videoRef.current) return

        // Stop any existing tracks
        if (videoRef.current.srcObject instanceof MediaStream) {
          videoRef.current.srcObject.getTracks().forEach(track => track.stop())
          videoRef.current.srcObject = null
        }

        // Create new stream if video or audio is enabled
        if (localVideoEnabled || localAudioEnabled) {
          const constraints: MediaStreamConstraints = {}
          if (localVideoEnabled) {
            constraints.video = true
          }
          if (localAudioEnabled) {
            constraints.audio = true
          }

          const stream = await navigator.mediaDevices.getUserMedia(constraints)
          
          // Set initial track states
          stream.getVideoTracks().forEach(track => {
            track.enabled = localVideoEnabled
          })
          stream.getAudioTracks().forEach(track => {
            track.enabled = localAudioEnabled
          })

          // Update the stream in WebRTC context
          setLocalStream(stream)
          setHasPermission(true)
          setError('')
        } else {
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
  }, [localVideoEnabled, localAudioEnabled])

  return (
    <div className="relative w-full max-w-[400px] mx-auto">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 p-4 rounded-lg text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>
      )}
      <div style={connectionStatus === 'connected' ? { width: '200px', height: '150px' } : { width: '400px', height: '300px' }} 
        className="relative mx-auto bg-gray-100 dark:bg-gray-800 rounded-lg">
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
        {/* Name overlay */}
        <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm">
          {name || 'Me'}
        </div>
      </div>
    </div>
  )
}