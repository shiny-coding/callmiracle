'use client';

import { useRef } from 'react';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video';
import ConnectionRequest from './ConnectionRequest';
import { Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/useStore';
import { useWebRTCContext } from './WebRTCProvider';

interface VideoChatProps {
  localStream?: MediaStream;
}

export default function VideoChat({ localStream }: VideoChatProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const t = useTranslations('VideoChat');
  const targetUserId = useStore(state => state.targetUserId);
  const { 
    connectionStatus, 
    incomingRequest, 
    handleAcceptCall, 
    handleRejectCall 
  } = useWebRTCContext();

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