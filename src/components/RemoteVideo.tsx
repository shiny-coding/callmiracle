'use client';

import { useRef, useEffect } from 'react';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video';
import ConnectionRequest from './ConnectionRequest';
import { Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/useStore';
import { useWebRTCContext } from './WebRTCProvider';

interface RemoteVideoProps {
  localStream?: MediaStream;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
}

export default function RemoteVideo({ localStream, remoteVideoRef }: RemoteVideoProps) {
  const t = useTranslations('VideoChat');
  const targetUserId = useStore(state => state.targetUserId);
  const {
    connectionStatus,
    incomingRequest,
    handleAcceptCall,
    handleRejectCall
  } = useWebRTCContext();

  useEffect(() => {
    // Reset video when connection is lost
    if (connectionStatus !== 'connected' && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [connectionStatus, remoteVideoRef]);

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
      <div className="relative w-full max-w-[200px] mx-auto">
        <div className="flex justify-between items-center mb-2">
          <Typography variant="subtitle1">Remote Video</Typography>
        </div>

        <div style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }} className="mx-auto relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }}
            className="rounded-lg shadow-lg object-cover bg-gray-100 dark:bg-gray-800"
          />
          {(!targetUserId || connectionStatus !== 'connected') && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Typography className={getStatusColor(connectionStatus)}>
                {!targetUserId ? t('selectUser') : t(`status.${connectionStatus}`)}
              </Typography>
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