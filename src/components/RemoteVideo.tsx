'use client';

import { useEffect } from 'react';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video';
import ConnectionRequest from './ConnectionRequest';
import { Typography, IconButton } from '@mui/material';
import CallEndIcon from '@mui/icons-material/CallEnd';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { useTranslations } from 'next-intl';
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider';

export default function RemoteVideo() {
  const t = useTranslations('VideoChat');
  const {
    connectionStatus,
    incomingRequest,
    handleAcceptCall,
    handleRejectCall,
    hangup,
    remoteVideoEnabled,
    remoteAudioEnabled,
    remoteName,
    remoteVideoRef
  } = useWebRTCContext();

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
      <div className="relative w-full max-w-[200px] mx-auto">
        <div className="flex justify-between items-center mb-2">
          <Typography variant="subtitle1">
            {connectionStatus === 'connected' ? remoteName : 'Brother'}
          </Typography>
          {connectionStatus === 'connected' && (
            <div className="flex gap-1">
              <div className="bg-white dark:bg-gray-800 p-1 rounded">
                {remoteAudioEnabled ? (
                  <MicIcon className="text-blue-500" fontSize="small" />
                ) : (
                  <MicOffIcon className="text-gray-500" fontSize="small" />
                )}
              </div>
              <div className="bg-white dark:bg-gray-800 p-1 rounded">
                {remoteVideoEnabled ? (
                  <VideocamIcon className="text-blue-500" fontSize="small" />
                ) : (
                  <VideocamOffIcon className="text-gray-500" fontSize="small" />
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }} className="mx-auto relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }}
            className="rounded-lg shadow-lg object-cover bg-gray-100 dark:bg-gray-800"
          />
          {connectionStatus !== 'connected' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Typography className={getStatusColor(connectionStatus)}>
                {t(`status.${connectionStatus}`)}
              </Typography>
            </div>
          )}
        </div>
        {connectionStatus === 'connected' && (
          <div className="flex justify-center mt-2">
            <IconButton
              onClick={hangup}
              className="bg-red-500 hover:bg-red-600 text-white"
              size="medium"
            >
              <CallEndIcon />
            </IconButton>
          </div>
        )}
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