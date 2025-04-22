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
import ProfileDialog from './ProfileDialog'
import MeetingDialog from './MeetingDialog'
import { useUpdateUser } from '@/hooks/useUpdateUser'

export default function LocalVideo() {
  const t = useTranslations()
  const tStatus = useTranslations('Status')
  const { currentUser, setCurrentUser, localVideoEnabled, localAudioEnabled, connectionStatus } = useStore()
  const { name = '', languages = [] } = currentUser || {}
  const { 
    localStream, 
    setLocalStream, 
  } = useWebRTCContext()
  const [profileOpen, setProfileOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [error, setError] = useState<string>('')

  // Stream management and video element updates
  useEffect(() => {
    let mounted = true
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
        if (!mounted) return
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

        // Update video source with new stream if video is enabled
        if (localVideoEnabled) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error('Error accessing media devices:', err)
        setError('Error accessing camera/microphone')
        setHasPermission(false)
        setLocalStream(undefined)
        if (videoRef.current?.srcObject instanceof MediaStream) {
          videoRef.current.srcObject.getTracks().forEach(track => track.stop())
          videoRef.current.srcObject = null
        }
      }
    }
    setupStream()
    return () => {
      mounted = false
    }
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
      </div>
      <ProfileDialog 
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <MeetingDialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
      />
    </div>
  )
}