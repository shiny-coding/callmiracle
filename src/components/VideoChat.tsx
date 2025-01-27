'use client';

import { useRef } from 'react';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video';
import ConnectionRequest from './ConnectionRequest';
import { Typography } from '@mui/material';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useTranslations } from 'next-intl';

interface VideoChatProps {
  targetUserId?: string;
  localStream?: MediaStream;
}

export default function VideoChat({ targetUserId, localStream }: VideoChatProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const t = useTranslations('VideoChat');

  const { 
    connectionStatus, 
    incomingRequest, 
    handleAcceptCall, 
    handleRejectCall 
  } = useWebRTC({
    targetUserId,
    localStream,
    onTrack: (event) => {
      console.log('VideoChat: OnTrack', event)
      if ( event.track.kind === 'video') {
        if (remoteVideoRef.current && event.streams[0]) {
          console.log('VideoChat: Received remote stream')
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'rejected':
      case 'timeout':
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-300';
    }
  };

  return (
    <>
      <div className="relative w-full max-w-[320px] mx-auto">
        <div style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }} className="mx-auto">
          {(!targetUserId || connectionStatus !== 'connected') && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Typography className={getStatusColor(connectionStatus)}>
                {!targetUserId ? t('selectUser') : t(`status.${connectionStatus}`)}
              </Typography>
            </div>
          )}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }}
            className="rounded-lg shadow-lg object-cover"
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