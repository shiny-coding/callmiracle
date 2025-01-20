'use client';

import { useRef } from 'react';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video';
import ConnectionRequest from './ConnectionRequest';
import { Typography } from '@mui/material';
import { useWebRTC } from '@/hooks/useWebRTC';

interface VideoChatProps {
  targetUserId?: string;
  localStream?: MediaStream;
}

export default function VideoChat({ targetUserId, localStream }: VideoChatProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const { 
    connectionStatus, 
    incomingRequest, 
    handleAcceptCall, 
    handleRejectCall 
  } = useWebRTC({
    targetUserId,
    localStream,
    onTrack: (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        console.log('VideoChat: Setting remote stream:', {
          hasStream: true,
          tracks: event.streams[0].getTracks().map(t => ({
            kind: t.kind,
            enabled: t.enabled,
            muted: t.muted
          }))
        })
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }
  });

  return (
    <>
      <div className="relative w-full max-w-[320px] mx-auto">
        <div style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }} className="mx-auto">
          {!targetUserId && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Typography className="text-gray-600 dark:text-gray-300">
                Select User
              </Typography>
            </div>
          )}
          {connectionStatus === 'waiting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Typography className="text-gray-600 dark:text-gray-300">
                Waiting for approval...
              </Typography>
            </div>
          )}
          {connectionStatus === 'rejected' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Typography className="text-red-600 dark:text-red-400">
                Offer rejected
              </Typography>
            </div>
          )}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }}
            className={`rounded-lg shadow-lg object-cover ${connectionStatus !== 'connected' && 'hidden'}`}
          />
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