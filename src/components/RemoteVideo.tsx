'use client';

import { useEffect, useState, useRef } from 'react';
import { IconButton } from '@mui/material';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import HdIcon from '@mui/icons-material/Hd';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import { useTranslations } from 'next-intl';
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider';
import VideoQualitySelector from './VideoQualitySelector';
import { useStore } from '@/store/useStore';

interface RemoteVideoProps {
  showTopControls?: boolean
}

export default function RemoteVideo({ showTopControls = false }: RemoteVideoProps) {
  const t = useTranslations('VideoChat');
  const overlayRef = useRef<HTMLDivElement>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isFitMode, setIsFitMode] = useState(true);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);

  const {
    qualityWeWantFromRemote,
    targetUser,
    localAudioEnabled,
    localVideoEnabled,
    setLocalAudioEnabled,
    setLocalVideoEnabled,
    setDeviceSettingsOpen
  } = useStore((state) => ({
    qualityWeWantFromRemote: state.qualityWeWantFromRemote,
    targetUser: state.targetUser,
    localAudioEnabled: state.localAudioEnabled,
    localVideoEnabled: state.localVideoEnabled,
    setLocalAudioEnabled: state.setLocalAudioEnabled,
    setLocalVideoEnabled: state.setLocalVideoEnabled,
    setDeviceSettingsOpen: state.setDeviceSettingsOpen
  }))
  const {
    connectionStatus,
    remoteVideoEnabled,
    remoteAudioEnabled,
    remoteVideoRef,
    sendWantedMediaState,
    caller,
    callee,
  } = useWebRTCContext();

  const handleAudioToggle = () => {
    setLocalAudioEnabled(!localAudioEnabled);
    sendWantedMediaState();
  };

  const handleVideoToggle = () => {
    setLocalVideoEnabled(!localVideoEnabled);
    sendWantedMediaState();
  };

  const handleDeviceSettings = () => {
    setDeviceSettingsOpen(true);
  };

  // Update overlay dimensions when video loads or resizes
  useEffect(() => {
    if (!remoteVideoRef.current) return

    const updateDimensions = () => {
      const video = remoteVideoRef.current
      if (!video || !video.videoWidth || !video.videoHeight) return

      const containerRect = video.parentElement?.getBoundingClientRect()
      if (!containerRect) return

      const containerAspectRatio = containerRect.width / containerRect.height
      const videoAspectRatio = video.videoWidth / video.videoHeight

      let width, height

      if (containerAspectRatio > videoAspectRatio) {
        // Container is wider than video - height will be maxed
        height = containerRect.height
        width = height * videoAspectRatio
      } else {
        // Container is taller than video - width will be maxed
        width = containerRect.width
        height = width / videoAspectRatio
      }

      setVideoDimensions({
        width,
        height
      })
    }

    const video = remoteVideoRef.current

    // Create ResizeObserver to watch for video element size changes
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(video)

    video.addEventListener('loadedmetadata', updateDimensions)
    video.addEventListener('resize', updateDimensions) // Listen for video resize events
    window.addEventListener('resize', updateDimensions)

    // Initial check
    if (video.videoWidth) {
      updateDimensions()
    }

    return () => {
      resizeObserver.disconnect()
      video.removeEventListener('loadedmetadata', updateDimensions)
      video.removeEventListener('resize', updateDimensions)
      window.removeEventListener('resize', updateDimensions)
    }
  }, [remoteVideoRef])

  // Attach stream when component mounts or stream becomes available
  useEffect(() => {
    if (connectionStatus === 'connected' && remoteVideoRef.current) {
      const activeStreamRef = caller.active ? caller.remoteStreamRef : callee.active ? callee.remoteStreamRef : null
      const stream = activeStreamRef?.current

      if (stream && remoteVideoRef.current.srcObject !== stream) {
        remoteVideoRef.current.srcObject = stream
      }
    }
  }, [connectionStatus, remoteVideoRef, caller.active, caller.remoteStreamRef, callee.active, callee.remoteStreamRef])

  useEffect(() => {
    // Reset video when connection is lost or disconnected
    if (connectionStatus !== 'connected' && remoteVideoRef.current) {
      const tracks = remoteVideoRef.current.srcObject instanceof MediaStream
        ? remoteVideoRef.current.srcObject.getTracks()
        : []

      // Stop all tracks
      for (const track of tracks) {
        track.stop()
      }

      // Clear the video source
      remoteVideoRef.current.srcObject = null
      setVideoDimensions(null)
    }
  }, [connectionStatus, remoteVideoRef])


  return (
    <>
        <div className="relative w-full h-full flex flex-col">
          {connectionStatus === 'connected' && showTopControls && (
            <div className="absolute top-0 left-0 right-0 pt-2 px-4 z-20">
              <div className="flex justify-between items-center">
                {/* Left side: Name only */}
                <div className="flex items-center gap-2">
                  <div className="text-white text-sm">
                    {targetUser?.name}
                  </div>
                </div>

                {/* Right side: FitScreen, Quality */}
                <div className="flex gap-2 items-center">
                  <IconButton
                    className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
                    onClick={() => setIsFitMode(!isFitMode)}
                    size="small"
                    sx={{
                      '@media (max-width: 768px)': {
                        padding: '8px',
                      },
                    }}
                  >
                    <FitScreenIcon
                      sx={{
                        color: 'white',
                        filter: 'drop-shadow(0 0 2px black)',
                        transform: !isFitMode ? 'rotate(90deg)' : 'none',
                        '@media (max-width: 768px)': {
                          fontSize: '1.5rem',
                        },
                      }}
                    />
                  </IconButton>

                  <IconButton
                    className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
                    onClick={() => setQualityDialogOpen(true)}
                    size="small"
                    sx={{
                      '@media (max-width: 768px)': {
                        padding: '8px',
                      },
                    }}
                  >
                    <div className="flex items-center">
                      <HdIcon
                        sx={{
                          color: 'white',
                          filter: 'drop-shadow(0 0 2px black)',
                          '@media (max-width: 768px)': {
                            fontSize: '1.5rem',
                          },
                        }}
                      />
                      <span className="ml-1 text-xs text-white" style={{ filter: 'drop-shadow(0 0 2px black)' }}>{qualityWeWantFromRemote}</span>
                    </div>
                  </IconButton>
                </div>
              </div>
            </div>
          )}
          <div className="w-full h-full flex items-center justify-center bg-black">
            {!remoteVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <VideocamOffIcon className="text-red-400 w-64 h-64" />
              </div>
            )}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full ${isFitMode ? 'object-contain' : 'object-cover'} ${!remoteVideoEnabled ? 'opacity-0 pointer-events-none' : ''}`}
            />
          </div>
        </div>

      <VideoQualitySelector
        open={qualityDialogOpen}
        onClose={() => setQualityDialogOpen(false)}
      />
    </>
  );
} 