'use client'

import { useState, useEffect, useRef } from 'react'
import { IconButton } from '@mui/material'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import SettingsIcon from '@mui/icons-material/Settings'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useStore } from '@/store/useStore'
import VideoLayoutControls, { VideoLayoutMode } from './VideoLayoutControls'
import RemoteVideo from './RemoteVideo'
import LocalVideo from './LocalVideo'

export default function ConnectedCallLayout() {
  const [layoutMode, setLayoutMode] = useState<VideoLayoutMode>('overlay')
  const [isSplitHorizontal, setIsSplitHorizontal] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const { hangup, remoteVideoRef, sendWantedMediaState } = useWebRTCContext()
  const {
    localVideoEnabled,
    localAudioEnabled,
    setLocalAudioEnabled,
    setLocalVideoEnabled,
    setDeviceSettingsOpen
  } = useStore((state) => ({
    localVideoEnabled: state.localVideoEnabled,
    localAudioEnabled: state.localAudioEnabled,
    setLocalAudioEnabled: state.setLocalAudioEnabled,
    setLocalVideoEnabled: state.setLocalVideoEnabled,
    setDeviceSettingsOpen: state.setDeviceSettingsOpen
  }))

  const handleAudioToggle = () => {
    setLocalAudioEnabled(!localAudioEnabled)
    sendWantedMediaState()
  }

  const handleVideoToggle = () => {
    setLocalVideoEnabled(!localVideoEnabled)
    sendWantedMediaState()
  }

  const handleDeviceSettings = () => {
    setDeviceSettingsOpen(true)
  }

  // Determine best split orientation based on container dimensions
  useEffect(() => {
    const updateOrientation = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        const isLandscape = width > height

        // If width > height, stack horizontally (side by side), else vertically (top/bottom)
        setIsSplitHorizontal(isLandscape)
      }
    }

    // Initial update with a small delay to ensure container is measured correctly
    const timeoutId = setTimeout(updateOrientation, 100)

    window.addEventListener('resize', updateOrientation)
    window.addEventListener('orientationchange', updateOrientation)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updateOrientation)
      window.removeEventListener('orientationchange', updateOrientation)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full bg-black" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Video content based on mode */}
      {layoutMode === 'overlay' && (
        <>
          {/* Remote video takes full space */}
          <div className="absolute inset-0">
            <RemoteVideo showTopControls={true} />
          </div>

          {/* Local video overlay at bottom right */}
          {localVideoEnabled && (
            <div className="absolute bottom-0 right-2 z-10 mb-12">
              <LocalVideo showDeviceSelection={false} compact={false} />
            </div>
          )}
        </>
      )}

      {layoutMode === 'split' && (
        <div className={`absolute inset-0 flex ${isSplitHorizontal ? 'flex-row' : 'flex-col'} gap-1`}>
          {/* Remote video - always first */}
          <div className={`flex-1 relative ${isSplitHorizontal ? 'min-w-0' : 'min-h-0'}`}>
            <RemoteVideo showTopControls={true} />
          </div>

          {/* Local video */}
          {localVideoEnabled && (
            <div className={`flex-1 relative ${isSplitHorizontal ? 'min-w-0' : 'min-h-0'}`}>
              <LocalVideo showDeviceSelection={false} compact={true} />
            </div>
          )}
        </div>
      )}

      {layoutMode === 'collapsed' && (
        <div className="absolute inset-0">
          <RemoteVideo showTopControls={true} />
        </div>
      )}

      {/* Controls overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2 z-20">
        <div className="flex items-center justify-between w-full max-w-[1536px]">
          {/* Left side: Mic, Video, Settings */}
          <div className="flex-1 flex gap-2 pl-2">
            <IconButton
              className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
              onClick={handleAudioToggle}
              size="small"
              sx={{
                '@media (max-width: 768px)': {
                  padding: '8px',
                },
              }}
            >
              {localAudioEnabled ? (
                <MicIcon
                  sx={{
                    color: 'white',
                    filter: 'drop-shadow(0 0 2px black)',
                    '@media (max-width: 768px)': {
                      fontSize: '1.5rem',
                    },
                  }}
                />
              ) : (
                <MicOffIcon
                  sx={{
                    color: '#f87171',
                    filter: 'drop-shadow(0 0 2px black)',
                    '@media (max-width: 768px)': {
                      fontSize: '1.5rem',
                    },
                  }}
                />
              )}
            </IconButton>

            <IconButton
              className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
              onClick={handleVideoToggle}
              size="small"
              sx={{
                '@media (max-width: 768px)': {
                  padding: '8px',
                },
              }}
            >
              {localVideoEnabled ? (
                <VideocamIcon
                  sx={{
                    color: 'white',
                    filter: 'drop-shadow(0 0 2px black)',
                    '@media (max-width: 768px)': {
                      fontSize: '1.5rem',
                    },
                  }}
                />
              ) : (
                <VideocamOffIcon
                  sx={{
                    color: '#f87171',
                    filter: 'drop-shadow(0 0 2px black)',
                    '@media (max-width: 768px)': {
                      fontSize: '1.5rem',
                    },
                  }}
                />
              )}
            </IconButton>

            <IconButton
              className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
              onClick={handleDeviceSettings}
              size="small"
              sx={{
                '@media (max-width: 768px)': {
                  padding: '8px',
                },
              }}
            >
              <SettingsIcon
                sx={{
                  color: 'white',
                  filter: 'drop-shadow(0 0 2px black)',
                  '@media (max-width: 768px)': {
                    fontSize: '1.5rem',
                  },
                }}
              />
            </IconButton>
          </div>

          {/* Hangup button in center */}
          <IconButton
            onClick={hangup}
            size="small"
            sx={{
              backgroundColor: 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
              },
              '@media (max-width: 768px)': {
                padding: '8px',
              },
            }}
          >
            <CallEndIcon
              sx={{
                color: '#dc2626',
                filter: 'drop-shadow(0 0 2px black)',
                '@media (max-width: 768px)': {
                  fontSize: '1.5rem',
                },
              }}
            />
          </IconButton>

          {/* Layout controls on right */}
          <div className="flex-1 flex justify-end pr-2">
            <VideoLayoutControls mode={layoutMode} onModeChange={setLayoutMode} isSplitHorizontal={isSplitHorizontal} />
          </div>
        </div>
      </div>
    </div>
  )
}
