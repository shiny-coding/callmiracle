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

type ConnectionStatus = 'disconnected' | 'calling' | 'connecting' | 'connected' | 'failed' | 'rejected' | 'timeout'

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
  onTrack: (event: RTCTrackEvent) => void
}

export function useWebRTC({ targetUserId, localStream, onTrack }: UseWebRTCProps) {
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null)

  // Add refs to track state and timeouts
  const activeRequestRef = useRef<string | null>(null)
  const lastOfferRef = useRef<string | null>(null)
  const iceCandidateBuffer = useRef<RTCIceCandidate[]>([])
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iceConnectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasTimedOutRef = useRef<boolean>(false)

  const logWebRTCState = (event: string, pc: RTCPeerConnection, error?: any) => {
    const baseState = {
      status: connectionStatus,
      connectionState: pc.connectionState,
      signalingState: pc.signalingState,
      iceConnectionState: pc.iceConnectionState,
      iceGatheringState: pc.iceGatheringState
    }

    if (error) {
      console.log(`WebRTC: ${event}:`, error, baseState)
    } else {
      console.log(`WebRTC: ${event}:`, baseState)
    }
  }

  const clearAllTimeouts = () => {
    clearTimeout(connectionTimeoutRef.current as any)
    connectionTimeoutRef.current = null
    clearTimeout(iceConnectionTimeoutRef.current as any)
    iceConnectionTimeoutRef.current = null
    clearTimeout(answerTimeoutRef.current as any)
    answerTimeoutRef.current = null
  }

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voip.blackberry.com:3478' },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all'
    })

    pc.ontrack = onTrack

    pc.onconnectionstatechange = () => {
      logWebRTCState('Connection state changed to ' + pc.connectionState, pc)
      
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected')
        clearAllTimeouts()
      } else if (pc.connectionState === 'failed') {
        console.log('Connection failed, setting timeout')
        clearTimeout(connectionTimeoutRef.current as any)
        connectionTimeoutRef.current = setTimeout(() => {
          if (pc.connectionState === 'failed') {
            logWebRTCState('Connection failed after delay', pc)
            pc.close()
            peerConnection.current = null
            setConnectionStatus('failed')
          }
        }, CONNECTION_TIMEOUT_MS)
      }
    }

    pc.oniceconnectionstatechange = () => {
      logWebRTCState('ICE connection state changed', pc)
      
      if (pc.iceConnectionState === 'disconnected') {
        logWebRTCState('ICE disconnected, setting timeout', pc)
        clearTimeout(iceConnectionTimeoutRef.current as any)
        iceConnectionTimeoutRef.current = setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' && pc.connectionState !== 'connected') {
            logWebRTCState('ICE still disconnected after delay', pc)
            setConnectionStatus('failed')
          }
        }, CONNECTION_TIMEOUT_MS)
      } else if (pc.iceConnectionState === 'failed') {
        logWebRTCState('ICE connection failed, setting timeout', pc)
        clearTimeout(iceConnectionTimeoutRef.current as any)
        iceConnectionTimeoutRef.current = setTimeout(() => {
          if (pc.iceConnectionState === 'failed' && pc.connectionState !== 'connected') {
            logWebRTCState('ICE still failed after delay', pc)
            setConnectionStatus('failed')
          }
        }, CONNECTION_TIMEOUT_MS)
      }
    }

    pc.onicegatheringstatechange = () => {
      logWebRTCState('ICE gathering state changed to ' + pc.iceGatheringState, pc)
    }

    return pc
  }

  const addLocalStream = (pc: RTCPeerConnection, stream: MediaStream) => {
    console.log('WebRTC: Adding local stream tracks:', {
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

    console.log('WebRTC: Configured transceivers:', {
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

  const setupIceCandidateHandler = (pc: RTCPeerConnection, targetUserId: string) => {
    pc.onicecandidate = async (event) => {
      logWebRTCState('New ICE candidate', pc)
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
          console.error('WebRTC: Failed to send ICE candidate:', err)
        }
      }
    }
  }

  const handleAcceptCall = async () => {
    if (!incomingRequest || !localStream) return

    try {
      console.log('WebRTC: Accepting call from:', incomingRequest.from.name)
      setConnectionStatus('connecting')
      
      const pc = createPeerConnection()
      peerConnection.current = pc

      addLocalStream(pc, localStream)

      // Set remote description (offer)
      const offer = JSON.parse(incomingRequest.offer)
      console.log('WebRTC: Parsed offer:', {
        type: offer.type,
        hasSdp: !!offer.sdp,
        sdpLength: offer.sdp?.length
      })
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Create and send answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      logWebRTCState('Remote description set', pc)

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

      console.log('WebRTC: Answer sent to server')

      // Add ICE candidate handling
      setupIceCandidateHandler(pc, incomingRequest.from.userId)

      activeRequestRef.current = null
      lastOfferRef.current = null
      setIncomingRequest(null)
    } catch (error) {
      console.error('Error accepting call:', error)
      activeRequestRef.current = null
      lastOfferRef.current = null
      setConnectionStatus('failed')
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
        console.log('WebRTC: Processing connection request:', {
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
            console.log('WebRTC: Received answer via subscription')
            const answer = JSON.parse(request.answer)
            
            if (peerConnection.current.signalingState === 'have-local-offer') {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer))
              logWebRTCState('Set remote description from subscription', peerConnection.current)
              
              if (iceCandidateBuffer.current.length > 0) {
                console.log('WebRTC: Processing buffered ICE candidates:', iceCandidateBuffer.current.length)
                for (const candidate of iceCandidateBuffer.current) {
                  await peerConnection.current.addIceCandidate(candidate)
                  console.log('WebRTC: Added buffered ICE candidate')
                }
                iceCandidateBuffer.current = []
              }
            } else {
              console.warn('WebRTC: Received answer in invalid state:', peerConnection.current.signalingState)
            }
            return
          } catch (err) {
            console.error('WebRTC: Failed to process answer:', err)
          }
        }
        
        // Handle ICE candidates for existing connection
        if (request.type === 'ice-candidate' && peerConnection.current) {
          try {
            const candidate = JSON.parse(request.iceCandidate)
            if (peerConnection.current.remoteDescription) {
              await peerConnection.current.addIceCandidate(candidate)
              console.log('WebRTC: Added remote ICE candidate')
            } else {
              console.log('WebRTC: Buffering ICE candidate until remote description is set')
              iceCandidateBuffer.current.push(candidate)
            }
            return
          } catch (err) {
            console.error('WebRTC: Failed to add ICE candidate:', err)
          }
        }
        
        // Only show the request dialog for new offers
        if (request.type === 'offer' && 
            activeRequestRef.current !== request.from.userId && 
            lastOfferRef.current !== request.offer) {
          if (peerConnection.current) {
            console.log('WebRTC: Cleaning up existing connection')
            peerConnection.current.close()
            peerConnection.current = null
          }
          activeRequestRef.current = request.from.userId
          lastOfferRef.current = request.offer
          setIncomingRequest(request)
          setConnectionStatus('calling')
        }
      }
    }
  })

  const resetConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    clearAllTimeouts()
    activeRequestRef.current = null
    lastOfferRef.current = null
    iceCandidateBuffer.current = []
    hasTimedOutRef.current = false
  }

  // Handle outgoing calls
  useEffect(() => {
    async function initializeConnection() {
      if (!targetUserId || !localStream || hasTimedOutRef.current) return

      console.log('WebRTC: Initializing connection with:', targetUserId)
      setConnectionStatus('calling')
      
      const pc = createPeerConnection()
      peerConnection.current = pc

      addLocalStream(pc, localStream)

      // Add ICE candidate handling for initiator
      setupIceCandidateHandler(pc, targetUserId)

      try {
        // Create and send offer
        logWebRTCState('Creating offer', pc)
        const offer = await pc.createOffer()
        logWebRTCState('Setting local description', pc)
        await pc.setLocalDescription(offer)

        logWebRTCState('Sending offer to server', pc)
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
        clearTimeout(answerTimeoutRef.current as any)
        answerTimeoutRef.current = setTimeout(() => {
          if (pc.signalingState !== 'stable') {
            logWebRTCState('No answer received within timeout period', pc, true)
            hasTimedOutRef.current = true
            setConnectionStatus('timeout')
            resetConnection()
          }
        }, CONNECTION_TIMEOUT_MS)

        return () => {
          resetConnection()
          setConnectionStatus('disconnected')
        }
      } catch (error) {
        logWebRTCState('WebRTC setup error', pc, error)
        setConnectionStatus('failed')
        resetConnection()
      }
    }

    if (targetUserId) {
      initializeConnection()
    } else {
      resetConnection()
      setConnectionStatus('disconnected')
    }

    return () => {
      resetConnection()
      setConnectionStatus('disconnected')
    }
  }, [targetUserId, localStream, connectWithUser])

  return {
    connectionStatus,
    incomingRequest,
    handleAcceptCall,
    handleRejectCall,
    resetConnection
  }
} 