'use client';

import { useEffect, useState, useRef } from 'react';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video';
import ConnectionRequest from './ConnectionRequest';
import { Typography } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { useTranslations } from 'next-intl';
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider';

export default function RemoteVideo() {
  const t = useTranslations('VideoChat');
  const overlayRef = useRef<HTMLDivElement>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const {
    connectionStatus,
    incomingRequest,
    handleAcceptCall,
    handleRejectCall,
    remoteVideoEnabled,
    remoteAudioEnabled,
    remoteName,
    remoteVideoRef
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
      <div className="absolute inset-0 bg-gray-900">
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          
          {connectionStatus === 'connected' && videoDimensions && (
            <div 
              ref={overlayRef}
              className="absolute z-10 pointer-events-none"
              style={{
                width: videoDimensions.width,
                height: videoDimensions.height,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 p-4">
                <div className="flex justify-between items-center">
                  <div className="bg-black/50 px-2 py-1 rounded text-white text-sm">
                    {remoteName}
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-black/50 w-8 h-8 rounded flex items-center justify-center">
                      {remoteAudioEnabled ? (
                        <MicIcon className="text-white" fontSize="small" />
                      ) : (
                        <MicOffIcon className="text-white" fontSize="small" />
                      )}
                    </div>
                    <div className="bg-black/50 w-8 h-8 rounded flex items-center justify-center">
                      {remoteVideoEnabled ? (
                        <VideocamIcon className="text-white" fontSize="small" />
                      ) : (
                        <VideocamOffIcon className="text-white" fontSize="small" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConnectionRequest
        open={!!incomingRequest}
        user={incomingRequest?.from || null}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />
    </>
  );
} 