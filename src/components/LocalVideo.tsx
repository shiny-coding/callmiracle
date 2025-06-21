'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useStore } from '@/store/useStore'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { LANGUAGES } from '@/config/languages'

export default function LocalVideo() {
  const t = useTranslations()
  const { currentUser, localVideoEnabled, localAudioEnabled, connectionStatus } = useStore((state) => ({
    currentUser: state.currentUser,
    localVideoEnabled: state.localVideoEnabled,
    localAudioEnabled: state.localAudioEnabled,
    connectionStatus: state.connectionStatus
  }))
  const { name = '', languages = [] } = currentUser || {}
  const { localStream } = useWebRTCContext()
  const [profileOpen, setProfileOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string>('')

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
    </div>
  )
}