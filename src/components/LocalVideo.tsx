'use client'

import { useEffect, useRef, useState } from 'react'
import { IconButton, FormControl, InputLabel, Select, MenuItem, Typography, Button } from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import { useTranslations } from 'next-intl'
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { LANGUAGES } from '@/config/languages'
import ProfileSettings from './ProfileSettings'
import StatusSettings from './StatusSettings'
import { useUpdateUser } from '@/hooks/useUpdateUser'
import { getUserId } from '@/lib/userId'

export default function LocalVideo() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [error, setError] = useState<string>('')
  const t = useTranslations()
  const tStatus = useTranslations('Status')
  const { name, languages, statuses } = useStore()
  const { 
    localStream, 
    setLocalStream, 
    localVideoEnabled, 
    setLocalVideoEnabled, 
    localAudioEnabled, 
    setLocalAudioEnabled,
    connectionStatus
  } = useWebRTCContext()

  const { updateUserData } = useUpdateUser()

  const handleOnlineToggle = async () => {
    const newOnlineState = !isOnline
    try {
      await updateUserData(newOnlineState)
      setIsOnline(newOnlineState)
    } catch (error) {
      console.error('Failed to update online status:', error)
    }
  }

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

        // Always create stream with both video and audio tracks
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
          
        // Set initial track states based on preferences
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
        {/* Name overlay */}
        <div 
          className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm cursor-pointer hover:bg-black/60"
          onClick={() => setProfileOpen(true)}
        >
          {name || 'Me'}
        </div>
        {/* Languages overlay */}
        {connectionStatus !== 'connected' && languages.length > 0 && (
          <div 
            className="absolute top-2 right-2 flex flex-col gap-1 cursor-pointer"
            onClick={() => setProfileOpen(true)}
          >
            {languages.map(lang => (
              <div 
                key={lang} 
                className="bg-black/50 px-2 py-1 rounded text-white text-sm hover:bg-black/60"
              >
                {(() => {
                  const langName = LANGUAGES.find(l => l.code === lang)?.name
                  const parts = langName?.split(' - ')
                  return parts?.[1] || parts?.[0]
                })()}
              </div>
            ))}
          </div>
        )}
        {/* Status overlay */}
        {connectionStatus !== 'connected' && statuses.length > 0 && (
          <div 
            className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 cursor-pointer"
            onClick={() => setStatusOpen(true)}
          >
            {statuses.map(status => (
              <div 
                key={status} 
                className="bg-black/50 px-2 py-1 rounded text-white text-sm hover:bg-black/60"
              >
                {tStatus(status)}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {connectionStatus !== 'connected' && (
        <div className="mt-4 flex justify-center">
          <Button
            variant={isOnline ? "contained" : "outlined"}
            color={isOnline ? "primary" : "inherit"}
            onClick={handleOnlineToggle}
            className="w-full max-w-[200px]"
          >
            {isOnline ? t('online') : t('offline')}
          </Button>
        </div>
      )}

      <ProfileSettings 
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <StatusSettings
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
      />
    </div>
  )
}