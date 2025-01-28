import { useRef, useState, useEffect } from 'react'
import { gql, useMutation, useSubscription } from '@apollo/client'
import { getUserId } from '@/lib/userId'

const CONNECTION_TIMEOUT_MS = 120000 // 20 seconds

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
  connectWithVideo?: boolean
}

export function useWebRTC({ targetUserId, localStream, onTrack, connectWithVideo = true }: UseWebRTCProps) {
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null)

  // Add refs to track state and timeouts
  const activeRequestRef = useRef<string | null>(null)
  const lastOfferRef = useRef<string | null>(null)
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([])
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
        // { urls: 'stun:stun.cloudflare.com:3478' },
      ],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
    })

    pc.ontrack = onTrack

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected')
        logWebRTCState('Connection state changed to ' + pc.connectionState, pc)
        clearAllTimeouts()
      } else if (pc.connectionState === 'failed') {
        logWebRTCState('Connection state changed to ' + pc.connectionState, pc)
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
      logWebRTCState('ICE connection state changed to ' + pc.iceConnectionState, pc)
      
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

    // First set up transceivers for both audio and video
    if (!pc.getTransceivers().length) {
      pc.addTransceiver('audio', { direction: 'sendrecv' })
      if (connectWithVideo) {
        pc.addTransceiver('video', { direction: 'sendrecv' })
      }
    }

    // Then add tracks
    stream.getTracks().forEach(track => {
      const existingSender = pc.getSenders().find(s => s.track?.kind === track.kind)
      if (existingSender) {
        if (track.kind === 'video' && !connectWithVideo) {
          track.enabled = false
          track.stop()
        } else {
          existingSender.replaceTrack(track)
        }
      } else if (track.kind === 'audio' || (track.kind === 'video' && connectWithVideo)) {
        pc.addTrack(track, stream)
      }
    })

    // Configure transceivers
    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.sender.track?.kind || transceiver.mid
      if (kind === 'video' || kind === '1') {
        if (connectWithVideo) {
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
        } else {
          transceiver.direction = 'inactive'
        }
      } else if (kind === 'audio' || kind === '0') {
        transceiver.direction = 'sendrecv'
      }
    }

    console.log('WebRTC: Configured transceivers:', {
      count: pc.getTransceivers().length,
      transceivers: pc.getTransceivers().map(t => ({
        kind: t.sender.track?.kind || t.mid,
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
          logWebRTCState(`Sent ICE candidate`, pc)
        } catch (err) {
          console.error('WebRTC: Failed to send ICE candidate:', err)
        }
      } else {
        console.log('WebRTC: onicecandidate without candidate')
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

      // Process any pending ICE candidates
      if (pendingIceCandidates.current.length > 0) {
        console.log('WebRTC: Processing pending ICE candidates:', pendingIceCandidates.current.length)
        for (const candidate of pendingIceCandidates.current) {
          await pc.addIceCandidate(candidate)
          const candidateInfo = parseCandidate(candidate)
          console.log(`WebRTC: Added buffered ICE candidate:`, candidateInfo)
        }
        pendingIceCandidates.current = []
      }

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
        if (request.type === 'answer') {
          if (!peerConnection.current) {
            throw new Error('WebRTC: No peer connection found when receiving answer')
          }
          try {
            console.log('WebRTC: Received answer via subscription')
            const answer = JSON.parse(request.answer)
            
            if (peerConnection.current.signalingState === 'have-local-offer') {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer))
              logWebRTCState('Set remote description from subscription', peerConnection.current)
            } else {
              console.warn('WebRTC: Received answer in invalid state:', peerConnection.current.signalingState)
            }
            return
          } catch (err) {
            console.error('WebRTC: Failed to process answer:', err)
          }
        }
        
        // Handle ICE candidates
        if (request.type === 'ice-candidate') {
          try {
            const candidate = JSON.parse(request.iceCandidate)
            const candidateInfo = parseCandidate(candidate)
            
            if (peerConnection.current) {
              await peerConnection.current.addIceCandidate(candidate)
              console.log(`WebRTC: Added remote ICE candidate:`, candidateInfo)
            } else if (incomingRequest) {
              // Buffer ICE candidates if we're in the process of accepting a call
              console.log(`WebRTC: Buffering ICE candidate:`, candidateInfo)
              pendingIceCandidates.current.push(candidate)
            }
            return
          } catch (err) {
            console.error('WebRTC: Failed to handle ICE candidate:', err)
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
          pendingIceCandidates.current = [] // Clear any pending candidates from previous calls
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
    pendingIceCandidates.current = []
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

  function parseCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate.candidate) return null
    const parts = candidate.candidate.split(' ')
    return {
      foundation: parts[0].split(':')[1],
      component: parts[1],
      protocol: parts[2].toLowerCase(),
      priority: parseInt(parts[3], 10),
      ip: parts[4],
      port: parseInt(parts[5], 10),
      type: parts[7],
    }
  }

  return {
    connectionStatus,
    incomingRequest,
    handleAcceptCall,
    handleRejectCall,
    resetConnection
  }
} 