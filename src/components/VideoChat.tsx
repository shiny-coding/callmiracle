'use client';

import { useEffect, useRef } from 'react';
import { WebRTCConnection } from '@/lib/webrtc/connection';

export default function VideoChat({ 
  roomId, 
  userId 
}: { 
  roomId: string;
  userId: string;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const rtcConnection = useRef<WebRTCConnection>(null);

  useEffect(() => {
    const initializeVideoChat = async () => {
      try {
        // 1. Get local stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        // 2. Show local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 3. Initialize WebRTC
        rtcConnection.current = new WebRTCConnection({
          wsUrl: `wss://your-signaling-server.com/${roomId}`,
          targetUserId: userId,
          onRemoteStream: (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          }
        });

      } catch (error) {
        console.error('Failed to initialize video chat:', error);
      }
    };

    initializeVideoChat();

    return () => {
      // Cleanup
      rtcConnection.current?.disconnect();
    };
  }, [roomId, userId]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <video
        ref={localVideoRef}
        autoPlay
        muted // Mute local video to prevent feedback
        className="w-full rounded-lg"
      />
      <video
        ref={remoteVideoRef}
        autoPlay
        className="w-full rounded-lg"
      />
    </div>
  );
} 