'use client';

import { useEffect, useRef, useState } from 'react';
import { gql, useMutation, useSubscription } from '@apollo/client';
import { getUserId } from '@/lib/userId';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '@/config/video';
import ConnectionRequest from './ConnectionRequest';
import { Typography } from '@mui/material';

const CONNECT_WITH_USER = gql`
  mutation ConnectWithUser($input: ConnectionParamsInput!) {
    connectWithUser(input: $input) {
      offer
      answer
      targetUserId
      initiatorUserId
    }
  }
`;

const ON_CONNECTION_REQUEST = gql`
  subscription OnConnectionRequest($userId: ID!) {
    onConnectionRequest(userId: $userId) {
      offer
      from {
        userId
        name
        languages
        statuses
      }
    }
  }
`;

interface VideoChatProps {
  targetUserId: string;
  localStream?: MediaStream;
}

type ConnectionStatus = 'waiting' | 'rejected' | 'connected' | null;

export default function VideoChat({ targetUserId, localStream }: VideoChatProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [connectWithUser] = useMutation(CONNECT_WITH_USER);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [incomingRequest, setIncomingRequest] = useState<{
    offer: string;
    from: {
      userId: string;
      name: string;
      languages: string[];
      statuses: string[];
    }
  } | null>(null);

  // Subscribe to incoming connection requests
  useSubscription(ON_CONNECTION_REQUEST, {
    variables: { userId: getUserId() },
    onData: ({ data }) => {
      console.log('Received connection request:', data);
      if (data.data?.onConnectionRequest) {
        setIncomingRequest(data.data.onConnectionRequest);
        setConnectionStatus(null); // Reset status when receiving new request
      }
    }
  });

  const handleAcceptCall = async () => {
    if (!incomingRequest) return;

    try {
      console.log('Accepting call from:', incomingRequest.from.name);
      setConnectionStatus('connected');
      
      // Create peer connection for incoming call
      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Add local stream
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.current?.addTrack(track, localStream);
        });
      }

      // Handle incoming stream
      peerConnection.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Set remote description (offer)
      const offer = JSON.parse(incomingRequest.offer);
      await peerConnection.current.setRemoteDescription(offer);

      // Create and send answer
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      await connectWithUser({
        variables: {
          input: {
            targetUserId: incomingRequest.from.userId,
            answer: JSON.stringify(answer)
          }
        }
      });

      setIncomingRequest(null);
    } catch (error) {
      console.error('Error accepting call:', error);
      setConnectionStatus(null);
    }
  };

  const handleRejectCall = () => {
    console.log('Rejecting call from:', incomingRequest?.from.name);
    setIncomingRequest(null);
    setConnectionStatus('rejected');
  };

  useEffect(() => {
    async function initializeConnection() {
      console.log('Initializing WebRTC connection with:', targetUserId);
      setConnectionStatus('waiting');
      
      // Create peer connection
      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Log connection state changes
      peerConnection.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.current?.connectionState);
        if (peerConnection.current?.connectionState === 'connected') {
          setConnectionStatus('connected');
        }
      };

      peerConnection.current.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.current?.iceConnectionState);
      };

      peerConnection.current.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', peerConnection.current?.iceGatheringState);
      };

      peerConnection.current.onsignalingstatechange = () => {
        console.log('Signaling state:', peerConnection.current?.signalingState);
      };

      // Log ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate.candidate);
        }
      };

      // Add local stream
      if (localStream) {
        console.log('Adding local stream tracks:', localStream.getTracks().length);
        localStream.getTracks().forEach(track => {
          peerConnection.current?.addTrack(track, localStream);
        });
      } else {
        console.warn('No local stream available');
      }

      // Handle incoming stream
      peerConnection.current.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        if (remoteVideoRef.current) {
          console.log('Setting remote stream');
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      try {
        // Create and send offer
        console.log('Creating offer');
        const offer = await peerConnection.current.createOffer();
        console.log('Setting local description');
        await peerConnection.current.setLocalDescription(offer);

        console.log('Sending offer to server');
        const result = await connectWithUser({
          variables: {
            input: {
              targetUserId,
              offer: JSON.stringify(offer)
            }
          }
        });

        // Handle answer
        if (result.data?.connectWithUser.answer) {
          console.log('Received answer from server');
          const answer = JSON.parse(result.data.connectWithUser.answer);
          console.log('Setting remote description');
          await peerConnection.current.setRemoteDescription(answer);
          setConnectionStatus('connected');
        } else {
          console.warn('No answer received from server');
        }
      } catch (error) {
        console.error('WebRTC setup error:', error);
        setConnectionStatus(null);
      }
    }

    if (targetUserId) {
      initializeConnection();
    }

    return () => {
      console.log('Cleaning up WebRTC connection');
      peerConnection.current?.close();
      setConnectionStatus(null);
    };
  }, [targetUserId, localStream, connectWithUser]);

  return (
    <>
      <div className="relative w-full max-w-[320px] mx-auto">
        <div style={{ width: `${VIDEO_WIDTH}px`, height: `${VIDEO_HEIGHT}px` }} className="mx-auto">
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