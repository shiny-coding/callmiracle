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
      iceCandidate
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
  targetUserId?: string;
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
    iceCandidate: string;
    from: {
      userId: string;
      name: string;
      languages: string[];
      statuses: string[];
    }
  } | null>(null);

  // Add a ref to track if we've already shown a request from this user
  const activeRequestRef = useRef<string | null>(null)

  // Add a ref to track the last processed offer
  const lastOfferRef = useRef<string | null>(null)

  // Subscribe to incoming connection requests
  const { data: subData } = useSubscription(ON_CONNECTION_REQUEST, {
    variables: { userId: getUserId() },
    onData: async ({ data }) => {
      console.log('VideoChat: Subscription data received:', {
        hasData: !!data.data,
        type: 'onConnectionRequest',
        timestamp: new Date().toISOString()
      })
      
      const request = data.data?.onConnectionRequest
      if (request) {
        console.log('VideoChat: Processing connection request:', {
          from: request.from.name,
          hasOffer: !!request.offer,
          hasIceCandidate: !!request.iceCandidate,
          timestamp: new Date().toISOString()
        })
        
        // Handle ICE candidates for existing connection
        if (request.iceCandidate && peerConnection.current) {
          try {
            const candidate = JSON.parse(request.iceCandidate)
            await peerConnection.current.addIceCandidate(candidate)
            console.log('VideoChat: Added remote ICE candidate')
            return // Don't process as new connection request
          } catch (err) {
            console.error('VideoChat: Failed to add ICE candidate:', err)
          }
        }
        
        // Only show the request dialog for new offers and if not already showing for this user
        if (request.offer && 
            activeRequestRef.current !== request.from.userId && 
            lastOfferRef.current !== request.offer) { // Check if this is a new offer
          // Clean up any existing peer connection before showing the request
          if (peerConnection.current) {
            console.log('VideoChat: Cleaning up existing connection')
            peerConnection.current.close()
            peerConnection.current = null
          }
          activeRequestRef.current = request.from.userId
          lastOfferRef.current = request.offer // Store the offer
          setIncomingRequest(request)
          setConnectionStatus(null) // Reset status when receiving new request
          console.log('VideoChat: Showing call request from:', request.from.name)
        }
      } else {
        console.log('VideoChat: Invalid or empty request data:', {
          data: data.data,
          timestamp: new Date().toISOString()
        })
      }
    },
    onError: (error) => {
      console.error('VideoChat: Subscription error:', error)
    }
  })

  // Log incoming request changes
  useEffect(() => {
    if (incomingRequest) {
      console.log('VideoChat: Showing call request from:', incomingRequest.from.name)
    }
  }, [incomingRequest])

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
        console.log('VideoChat: Received remote track:', {
          kind: event.track.kind,
          enabled: event.track.enabled,
          muted: event.track.muted,
          readyState: event.track.readyState,
          streams: event.streams.length
        })
        if (remoteVideoRef.current) {
          console.log('VideoChat: Setting remote stream:', {
            hasStream: !!event.streams[0],
            tracks: event.streams[0]?.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              muted: t.muted
            }))
          })
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      };

      // Set remote description (offer)
      console.log('VideoChat: Parsing offer:', {
        rawOffer: incomingRequest.offer?.substring(0, 100) + '...',
        isString: typeof incomingRequest.offer === 'string'
      });
      
      const offer = JSON.parse(incomingRequest.offer);
      console.log('VideoChat: Parsed offer:', {
        type: offer.type,
        hasSdp: !!offer.sdp,
        sdpLength: offer.sdp?.length
      });
      
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));

      // Create and send answer
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      console.log('VideoChat: Remote description set:', {
        signalingState: peerConnection.current.signalingState,
        connectionState: peerConnection.current.connectionState,
        iceGatheringState: peerConnection.current.iceGatheringState,
        iceConnectionState: peerConnection.current.iceConnectionState
      })

      console.log('VideoChat: Created answer:', {
        type: answer.type,
        sdp: answer.sdp?.substring(0, 100) + '...'
      })

      await connectWithUser({
        variables: {
          input: {
            targetUserId: incomingRequest.from.userId,
            initiatorUserId: getUserId(),
            answer: JSON.stringify(answer)
          }
        }
      });

      // Add ICE candidate handling
      peerConnection.current.onicecandidate = async (event) => {
        console.log('VideoChat: New ICE candidate:', {
          candidate: event.candidate?.candidate,
          sdpMid: event.candidate?.sdpMid,
          state: peerConnection.current?.iceGatheringState
        })
        if (event.candidate) {
          try {
            await connectWithUser({
              variables: {
                input: {
                  targetUserId: incomingRequest.from.userId,
                  initiatorUserId: getUserId(),
                  iceCandidate: JSON.stringify(event.candidate)
                }
              }
            })
          } catch (err) {
            console.error('VideoChat: Failed to send ICE candidate:', err)
          }
        }
      }

      // Add connection state change logging
      peerConnection.current.onconnectionstatechange = () => {
        console.log('VideoChat: Connection state changed:', {
          state: peerConnection.current?.connectionState,
          iceState: peerConnection.current?.iceConnectionState,
          signalingState: peerConnection.current?.signalingState
        })
      }

      activeRequestRef.current = null
      lastOfferRef.current = null
      setIncomingRequest(null);
    } catch (error) {
      console.error('Error accepting call:', error);
      activeRequestRef.current = null
      lastOfferRef.current = null
      setConnectionStatus(null);
    }
  };

  const handleRejectCall = () => {
    console.log('Rejecting call from:', incomingRequest?.from.name);
    activeRequestRef.current = null
    lastOfferRef.current = null
    setIncomingRequest(null);
    setConnectionStatus('rejected');
  };

  useEffect(() => {
    async function initializeConnection() {
      if (!targetUserId) return;

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
          // console.log('New ICE candidate:', event.candidate.candidate);
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

      // Add ICE candidate handling for initiator
      peerConnection.current.onicecandidate = async (event) => {
        console.log('VideoChat: New ICE candidate (initiator):', {
          candidate: event.candidate?.candidate,
          sdpMid: event.candidate?.sdpMid,
          state: peerConnection.current?.iceGatheringState
        })
        if (event.candidate) {
          try {
            await connectWithUser({
              variables: {
                input: {
                  targetUserId,
                  initiatorUserId: getUserId(),
                  iceCandidate: JSON.stringify(event.candidate)
                }
              }
            })
          } catch (err) {
            console.error('VideoChat: Failed to send ICE candidate:', err)
          }
        }
      }

      // Add more detailed connection state logging
      peerConnection.current.onconnectionstatechange = () => {
        console.log('VideoChat: Connection state changed (initiator):', {
          state: peerConnection.current?.connectionState,
          iceState: peerConnection.current?.iceConnectionState,
          signalingState: peerConnection.current?.signalingState
        })
        if (peerConnection.current?.connectionState === 'connected') {
          setConnectionStatus('connected')
        }
      }

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
              initiatorUserId: getUserId(),
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
    } else {
      // Clean up any existing connection when no user is selected
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      setConnectionStatus(null);
    }

    // Only clean up the WebRTC connection, not the subscription
    return () => {
      if (peerConnection.current) {
        console.log('Cleaning up WebRTC connection');
        peerConnection.current.close();
        peerConnection.current = null;
        setConnectionStatus(null);
      }
    };
  }, [targetUserId, localStream, connectWithUser]);

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