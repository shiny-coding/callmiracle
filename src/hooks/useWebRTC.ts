import { useRef, useState, useEffect } from 'react'
import { gql, useMutation, useSubscription } from '@apollo/client'
import { getUserId } from '@/lib/userId'

const CONNECTION_TIMEOUT_MS = 20000 // 20 seconds

const CONNECT_WITH_USER = gql`
  mutation ConnectWithUser($input: ConnectionParamsInput!) {
    connectWithUser(input: $input) {
      offer
      answer
      targetUserId
      initiatorUserId
    }
  }
`

const ON_CONNECTION_REQUEST = gql`
  subscription OnConnectionRequest($userId: ID!) {
    onConnectionRequest(userId: $userId) {
      type
      offer
      answer
      iceCandidate
      from {
        userId
        name
        languages
        statuses
      }
    }
  }
`

type ConnectionStatus = 'waiting' | 'rejected' | 'connected' | null

interface IncomingRequest {
  offer: string
  iceCandidate: string
  from: {
    userId: string
    name: string
    languages: string[]
    statuses: string[]
  }
}

interface UseWebRTCProps {
  targetUserId?: string
  localStream?: MediaStream
  onTrack?: (event: RTCTrackEvent) => void
}

export function useWebRTC({ targetUserId, localStream, onTrack }: UseWebRTCProps) {
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null)
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null)

  // Add refs to track state
  const activeRequestRef = useRef<string | null>(null)
  const lastOfferRef = useRef<string | null>(null)
  const iceCandidateBuffer = useRef<RTCIceCandidate[]>([])

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voip.blackberry.com:3478' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:relay.metered.ca:80',
          username: 'e8e137b5c81cdb4186a95ad5',
          credential: 'L+dbO2bQGVWFJfvq'
        },
        {
          urls: 'turn:relay.metered.ca:443',
          username: 'e8e137b5c81cdb4186a95ad5',
          credential: 'L+dbO2bQGVWFJfvq'
        }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all'
    })

    pc.ontrack = onTrack || ((event) => {
      console.log('VideoChat: Received remote track:', {
        kind: event.track.kind,
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState,
        streams: event.streams.length
      })
    })

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log('VideoChat: Connection state changed:', {
        state,
        iceState: pc.iceConnectionState,
        signalingState: pc.signalingState
      })
      
      if (state === 'connected') {
        setConnectionStatus('connected')
      } else if (state === 'failed') {
        setTimeout(() => {
          if (pc.connectionState === 'failed') {
            console.log('VideoChat: Connection failed after delay, cleaning up')
            pc.close()
            peerConnection.current = null
            setConnectionStatus(null)
          }
        }, CONNECTION_TIMEOUT_MS)
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      console.log('ICE connection state:', state)
      
      if (state === 'connected' || state === 'completed') {
        setConnectionStatus('connected')
      } else if (state === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            console.log('VideoChat: ICE still disconnected after delay')
            setConnectionStatus(null)
          }
        }, CONNECTION_TIMEOUT_MS)
      } else if (state === 'failed') {
        console.error('VideoChat: ICE connection failed')
        setTimeout(() => {
          if (pc.iceConnectionState === 'failed') {
            setConnectionStatus(null)
          }
        }, CONNECTION_TIMEOUT_MS)
      }
    }

    pc.onicegatheringstatechange = () => {
      console.log('VideoChat: ICE gathering state changed:', {
        state: pc.iceGatheringState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState
      })
    }

    return pc
  }

  const addLocalStream = (pc: RTCPeerConnection, stream: MediaStream) => {
    console.log('VideoChat: Adding local stream tracks:', {
      trackCount: stream.getTracks().length,
      tracks: stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted
      }))
    })

    // First add tracks to get transceivers created
    const senders = stream.getTracks().map(track => 
      pc.addTrack(track, stream)
    )

    // Get the transceivers that were created
    const transceivers = pc.getTransceivers()
    
    // Configure transceivers
    transceivers.forEach(transceiver => {
      const kind = transceiver.sender.track?.kind
      if (kind === 'video') {
        transceiver.direction = 'sendrecv'
        if (transceiver.sender.setParameters) {
          const params = transceiver.sender.getParameters()
          if (!params.encodings) {
            params.encodings = [{}]
          }
          params.encodings[0].maxBitrate = 2000000 // 2 Mbps
          params.encodings[0].maxFramerate = 30
          transceiver.sender.setParameters(params)
        }
      } else if (kind === 'audio') {
        transceiver.direction = 'sendrecv'
      }
    })

    console.log('VideoChat: Configured transceivers:', {
      count: transceivers.length,
      transceivers: transceivers.map(t => ({
        kind: t.sender.track?.kind,
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        sender: {
          track: t.sender.track?.kind,
          params: t.sender.getParameters()
        }
      }))
    })
  }

  const handleAcceptCall = async () => {
    if (!incomingRequest || !localStream) return

    try {
      console.log('Accepting call from:', incomingRequest.from.name)
      setConnectionStatus('connected')
      
      const pc = createPeerConnection()
      peerConnection.current = pc

      addLocalStream(pc, localStream)

      // Set remote description (offer)
      console.log('VideoChat: Parsing offer:', {
        rawOffer: incomingRequest.offer?.substring(0, 100) + '...',
        isString: typeof incomingRequest.offer === 'string'
      })
      
      const offer = JSON.parse(incomingRequest.offer)
      console.log('VideoChat: Parsed offer:', {
        type: offer.type,
        hasSdp: !!offer.sdp,
        sdpLength: offer.sdp?.length
      })
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Create and send answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      console.log('VideoChat: Remote description set:', {
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceGatheringState: pc.iceGatheringState,
        iceConnectionState: pc.iceConnectionState
      })

      console.log('VideoChat: Created answer:', {
        type: answer.type,
        sdp: answer.sdp?.substring(0, 100) + '...'
      })

      await connectWithUser({
        variables: {
          input: {
            type: 'answer',
            targetUserId: incomingRequest.from.userId,
            initiatorUserId: getUserId(),
            answer: JSON.stringify(answer)
          }
        }
      })

      console.log('VideoChat: Answer sent to server')

      // Add ICE candidate handling
      pc.onicecandidate = async (event) => {
        console.log('VideoChat: New ICE candidate:', {
          candidate: event.candidate?.candidate,
          sdpMid: event.candidate?.sdpMid,
          state: pc.iceGatheringState
        })
        if (event.candidate) {
          try {
            await connectWithUser({
              variables: {
                input: {
                  type: 'ice-candidate',
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

      activeRequestRef.current = null
      lastOfferRef.current = null
      setIncomingRequest(null)
    } catch (error) {
      console.error('Error accepting call:', error)
      activeRequestRef.current = null
      lastOfferRef.current = null
      setConnectionStatus(null)
    }
  }

  const handleRejectCall = () => {
    console.log('Rejecting call from:', incomingRequest?.from.name)
    activeRequestRef.current = null
    lastOfferRef.current = null
    setIncomingRequest(null)
    setConnectionStatus('rejected')
  }

  // Subscribe to incoming connection requests
  useSubscription(ON_CONNECTION_REQUEST, {
    variables: { userId: getUserId() },
    onData: async ({ data }) => {
      const request = data.data?.onConnectionRequest
      if (request) {
        console.log('VideoChat: Processing connection request:', {
          from: request.from.name,
          type: request.type,
          hasOffer: !!request.offer,
          hasIceCandidate: !!request.iceCandidate,
          sdpMid: request.iceCandidate ? JSON.parse(request.iceCandidate).sdpMid : undefined,
          timestamp: new Date().toISOString()
        })
        
        // Handle answer for initiator
        if (request.type === 'answer' && peerConnection.current) {
          try {
            console.log('VideoChat: Received answer via subscription')
            const answer = JSON.parse(request.answer)
            
            if (peerConnection.current.signalingState === 'have-local-offer') {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer))
              console.log('VideoChat: Set remote description from subscription:', {
                signalingState: peerConnection.current.signalingState,
                connectionState: peerConnection.current.connectionState,
                iceGatheringState: peerConnection.current.iceGatheringState,
                iceConnectionState: peerConnection.current.iceConnectionState
              })
              
              if (iceCandidateBuffer.current.length > 0) {
                console.log('VideoChat: Processing buffered ICE candidates:', iceCandidateBuffer.current.length)
                for (const candidate of iceCandidateBuffer.current) {
                  await peerConnection.current.addIceCandidate(candidate)
                  console.log('VideoChat: Added buffered ICE candidate')
                }
                iceCandidateBuffer.current = []
              }
            } else {
              console.warn('VideoChat: Received answer in invalid state:', peerConnection.current.signalingState)
            }
            return
          } catch (err) {
            console.error('VideoChat: Failed to process answer:', err)
          }
        }
        
        // Handle ICE candidates for existing connection
        if (request.type === 'ice-candidate' && peerConnection.current) {
          try {
            const candidate = JSON.parse(request.iceCandidate)
            if (peerConnection.current.remoteDescription) {
              await peerConnection.current.addIceCandidate(candidate)
              console.log('VideoChat: Added remote ICE candidate')
            } else {
              console.log('VideoChat: Buffering ICE candidate until remote description is set')
              iceCandidateBuffer.current.push(candidate)
            }
            return
          } catch (err) {
            console.error('VideoChat: Failed to add ICE candidate:', err)
          }
        }
        
        // Only show the request dialog for new offers
        if (request.type === 'offer' && 
            activeRequestRef.current !== request.from.userId && 
            lastOfferRef.current !== request.offer) {
          if (peerConnection.current) {
            console.log('VideoChat: Cleaning up existing connection')
            peerConnection.current.close()
            peerConnection.current = null
          }
          activeRequestRef.current = request.from.userId
          lastOfferRef.current = request.offer
          setIncomingRequest(request)
          setConnectionStatus(null)
        }
      }
    }
  })

  // Handle outgoing calls
  useEffect(() => {
    async function initializeConnection() {
      if (!targetUserId || !localStream) return

      console.log('Initializing WebRTC connection with:', targetUserId)
      setConnectionStatus('waiting')
      
      const pc = createPeerConnection()
      peerConnection.current = pc

      addLocalStream(pc, localStream)

      // Add ICE candidate handling for initiator
      pc.onicecandidate = async (event) => {
        console.log('VideoChat: New ICE candidate (initiator):', {
          candidate: event.candidate?.candidate,
          sdpMid: event.candidate?.sdpMid,
          state: pc.iceGatheringState
        })
        if (event.candidate) {
          try {
            await connectWithUser({
              variables: {
                input: {
                  type: 'ice-candidate',
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

      try {
        // Create and send offer
        console.log('Creating offer')
        const offer = await pc.createOffer()
        console.log('Setting local description')
        await pc.setLocalDescription(offer)

        console.log('Sending offer to server')
        await connectWithUser({
          variables: {
            input: {
              type: 'offer',
              targetUserId,
              initiatorUserId: getUserId(),
              offer: JSON.stringify(offer)
            }
          }
        })

        console.log('Offer sent, waiting for answer via subscription')
        
        // Set a timeout to reset connection if no answer received
        const answerTimeout = setTimeout(() => {
          if (pc.signalingState !== 'stable') {
            console.warn('No answer received within timeout period')
            setConnectionStatus(null)
            pc.close()
            peerConnection.current = null
          }
        }, CONNECTION_TIMEOUT_MS)

        return () => {
          clearTimeout(answerTimeout)
          pc.close()
          peerConnection.current = null
          setConnectionStatus(null)
        }
      } catch (error) {
        console.error('WebRTC setup error:', error)
        setConnectionStatus(null)
        pc.close()
        peerConnection.current = null
      }
    }

    if (targetUserId) {
      initializeConnection()
    } else {
      if (peerConnection.current) {
        peerConnection.current.close()
        peerConnection.current = null
      }
      setConnectionStatus(null)
    }

    return () => {
      if (peerConnection.current) {
        console.log('Cleaning up WebRTC connection')
        peerConnection.current.close()
        peerConnection.current = null
        setConnectionStatus(null)
      }
    }
  }, [targetUserId, localStream, connectWithUser])

  return {
    connectionStatus,
    incomingRequest,
    handleAcceptCall,
    handleRejectCall
  }
} 