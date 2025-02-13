'use client';

import { useEffect, useState, useRef } from 'react';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video';
import ConnectionRequest from './ConnectionRequest';
import { Typography, IconButton } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import HdIcon from '@mui/icons-material/Hd';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import { useTranslations } from 'next-intl';
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider';
import VideoQualitySelector from './VideoQualitySelector';

export default function RemoteVideo() {
  const t = useTranslations('VideoChat');
  const overlayRef = useRef<HTMLDivElement>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isFitMode, setIsFitMode] = useState(true);
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false);
  const {
    connectionStatus,
    incomingRequest,
    handleAcceptCall,
    handleRejectCall,
    remoteVideoEnabled,
    remoteAudioEnabled,
    remoteName,
    remoteVideoRef,
    remoteQuality
  } = useWebRTCContext();

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'rejected':
      case 'timeout':
      case 'failed':
        return 'text-red-600 dark:text-red-400'
      case 'finished':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-600 dark:text-gray-300'
    }
  };

  return (
    <>
        <div className="relative w-full h-full flex flex-col">
          {connectionStatus === 'connected' && (
            <div className="p-4 bg-gradient-to-b from-white/50 to-black">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="text-white text-sm">
                    {remoteName}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <IconButton
                    className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
                    onClick={() => setIsFitMode(!isFitMode)}
                  >
                    <FitScreenIcon className={`text-white transform ${!isFitMode ? 'rotate-90' : ''}`} />
                  </IconButton>

                  {remoteQuality && (
                    <IconButton
                      className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
                      onClick={() => setQualityDialogOpen(true)}
                    >
                      <div className="flex items-center">
                        <HdIcon className="text-white" />
                        <span className="ml-1 text-xs text-white">{remoteQuality}</span>
                      </div>
                    </IconButton>
                  )}

                  <IconButton
                    className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
                    disabled
                  >
                    {remoteAudioEnabled ? (
                      <MicIcon className="text-white" />
                    ) : (
                      <MicOffIcon className="text-white" />
                    )}
                  </IconButton>

                  <IconButton
                    className="bg-black/30 backdrop-blur-sm hover:bg-black/40"
                    disabled
                  >
                    {remoteVideoEnabled ? (
                      <VideocamIcon className="text-white" />
                    ) : (
                      <VideocamOffIcon className="text-white" />
                    )}
                  </IconButton>
                </div>
              </div>
            </div>
          )}
          <div className="w-full h-[calc(100%-72px)] flex items-center justify-center bg-black">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full ${isFitMode ? 'object-contain' : 'object-cover'}`}
            />
          </div>
        </div>

      <ConnectionRequest
        open={!!incomingRequest}
        user={incomingRequest?.from || null}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />
      <VideoQualitySelector
        open={qualityDialogOpen}
        onClose={() => setQualityDialogOpen(false)}
      />
    </>
  );
} 