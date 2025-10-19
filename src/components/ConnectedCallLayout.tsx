'use client'

import { useState, useEffect, useRef } from 'react'
import { IconButton } from '@mui/material'
import CallEndIcon from '@mui/icons-material/CallEnd'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import { useStore } from '@/store/useStore'
import VideoLayoutControls, { VideoLayoutMode } from './VideoLayoutControls'
import RemoteVideo from './RemoteVideo'
import LocalVideo from './LocalVideo'

export default function ConnectedCallLayout() {
  const [layoutMode, setLayoutMode] = useState<VideoLayoutMode>('overlay')
  const [isSplitHorizontal, setIsSplitHorizontal] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const { hangup, remoteVideoRef } = useWebRTCContext()
  const { localVideoEnabled } = useStore((state) => ({
    localVideoEnabled: state.localVideoEnabled
  }))

  // Determine best split orientation based on container dimensions
  useEffect(() => {
    const updateOrientation = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        // If width > height, stack horizontally (side by side), else vertically (top/bottom)
        setIsSplitHorizontal(width > height)
      }
    }

    updateOrientation()
    window.addEventListener('resize', updateOrientation)
    return () => window.removeEventListener('resize', updateOrientation)
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
            <div className="absolute bottom-20 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-2xl z-10 border-2 border-white/20">
              <LocalVideo showDeviceSelection={false} compact={true} />
            </div>
          )}
        </>
      )}

      {layoutMode === 'split' && (
        <div className={`absolute inset-0 flex ${isSplitHorizontal ? 'flex-row' : 'flex-col'} w-full h-full gap-1`}>
          {/* Remote video - always first */}
          <div className="flex-1 relative h-full w-full">
            <RemoteVideo showTopControls={true} />
          </div>

          {/* Local video */}
          {localVideoEnabled && (
            <div className="flex-1 relative h-full w-full">
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
          {/* Spacer for left side */}
          <div className="flex-1" />

          {/* Hangup button in center */}
          <IconButton
            onClick={hangup}
            size="small"
            sx={{
              backgroundColor: '#dc2626',
              '&:hover': {
                backgroundColor: '#b91c1c',
              },
              boxShadow: 3,
              '@media (max-width: 768px)': {
                padding: '8px',
              },
            }}
          >
            <CallEndIcon
              sx={{
                color: '#ffffff',
                filter: 'drop-shadow(0 0 2px black)',
                '@media (max-width: 768px)': {
                  fontSize: '1.5rem',
                },
              }}
            />
          </IconButton>

          {/* Layout controls on right */}
          <div className="flex-1 flex justify-end pr-2">
            <VideoLayoutControls mode={layoutMode} onModeChange={setLayoutMode} />
          </div>
        </div>
      </div>
    </div>
  )
}
