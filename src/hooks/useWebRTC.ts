import { useRef, useState, useEffect } from 'react'
import { gql, useMutation, useSubscription } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useStore } from '@/store/useStore'
import { User } from '@/generated/graphql'

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
  localStream?: MediaStream
  remoteVideoRef?: React.RefObject<HTMLVideoElement>
  localVideoEnabled?: boolean
  localAudioEnabled?: boolean
}

export function useWebRTC({ 
  localStream, 
  remoteVideoRef, 
  localVideoEnabled = true,
  localAudioEnabled = true 
}: UseWebRTCProps) {
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null)
  const targetUserId = useStore(state => state.targetUserId)
  const setTargetUserId = useStore(state => state.setTargetUserId)

  // Add refs to track state and timeouts
  const activeRequestRef = useRef<string | null>(null)
  const lastOfferRef = useRef<string | null>(null)
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([])
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iceConnectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasTimedOutRef = useRef<boolean>(false)
  const remoteStreamRef = useRef<MediaStream | null>(null)

  // Handle video/audio enabled state changes for active connections
  useEffect(() => {
    if (!peerConnection.current || !localStream) return

    const pc = peerConnection.current
    const senders = pc.getSenders()

    for (const sender of senders) {
      const track = sender.track
      if (!track) continue

      if (track.kind === 'video') {
        track.enabled = localVideoEnabled
        const transceiver = pc.getTransceivers().find(t => t.sender === sender)
        if (transceiver) {
          transceiver.direction = localVideoEnabled ? 'sendrecv' : 'inactive'
          if (localVideoEnabled && transceiver.sender.setParameters) {
            const params = transceiver.sender.getParameters()
            if (!params.encodings) {
              params.encodings = [{}]
            }
            params.encodings[0].maxBitrate = 2000000 // 2 Mbps
            params.encodings[0].maxFramerate = 30
            transceiver.sender.setParameters(params)
          }
        }
      } else if (track.kind === 'audio') {
        track.enabled = localAudioEnabled
        const transceiver = pc.getTransceivers().find(t => t.sender === sender)
        if (transceiver) {
          transceiver.direction = localAudioEnabled ? 'sendrecv' : 'inactive'
        }
      }
    }
  }, [localVideoEnabled, localAudioEnabled, localStream])

  const logWebRTCState = (event: string, pc: RTCPeerConnection, error?: any) => {
    const baseState = {
      event,
      signalingState: pc.signalingState,
      iceGatheringState: pc.iceGatheringState,
      iceConnectionState: pc.iceConnectionState,
      connectionState: pc.connectionState,
    }

    if (error) {
      console.error('WebRTC:', { ...baseState, error })
    } else {
      console.log('WebRTC:', baseState)
    }
  }

  const handleTrack = (event: RTCTrackEvent) => {
    if (!peerConnection.current) return
    
    console.log('WebRTC: OnTrack', event)
    // Only handle tracks from the remote peer
    if (!event.streams[0]?.id.includes(getUserId())) {
      const [remoteStream] = event.streams
      if (remoteStream && remoteVideoRef?.current) {
        // Keep using the same MediaStream for all tracks
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = remoteStream
          remoteVideoRef.current.srcObject = remoteStream
          logWebRTCState('Received first remote track: ' + event.track.kind, peerConnection.current)
        } else {
          logWebRTCState('Added remote track: ' + event.track.kind, peerConnection.current)
        }
      }
    } else {
      logWebRTCState('Ignored local track: ' + event.track.kind, peerConnection.current)
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

    logWebRTCState('create', pc)

    pc.ontrack = handleTrack

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
      } else {
        logWebRTCState('Connection state changed to ' + pc.connectionState, pc)
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

  const addLocalStream = (pc: RTCPeerConnection, stream: MediaStream, isInitiator: boolean) => {
    console.log('WebRTC: Adding local stream tracks:', {
      trackCount: stream.getTracks().length,
      tracks: stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted
      }))
    })

    if (isInitiator) {
      // First set up transceivers for both audio and video
      if (!pc.getTransceivers().length) {
        if (localAudioEnabled) {
          pc.addTransceiver('audio', { direction: 'sendrecv', streams: [stream] })
        }
        if (localVideoEnabled) {
          pc.addTransceiver('video', { direction: 'sendrecv', streams: [stream] })
        }
      }
    }

    // Then add tracks
    for (const track of stream.getTracks()) {
      const existingSender = pc.getSenders().find(s => s.track?.kind === track.kind)
      if (existingSender) {
        if (track.kind === 'video' && !localVideoEnabled) {
          track.enabled = false
          track.stop()
        } else if (track.kind === 'audio' && !localAudioEnabled) {
          track.enabled = false
          track.stop()
        } else {
          existingSender.replaceTrack(track)
        }
      } else if ((track.kind === 'audio' && localAudioEnabled) || (track.kind === 'video' && localVideoEnabled)) {
        pc.addTrack(track, stream)
      }
    }

    // Configure transceivers
    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.sender.track?.kind || transceiver.mid
      if (kind === 'video' || kind === '1') {
        if (localVideoEnabled) {
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
        transceiver.direction = localAudioEnabled ? 'sendrecv' : 'inactive'
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

      addLocalStream(pc, localStream, false)

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
    onSubscriptionData: async ({ subscriptionData }) => {
      const request = subscriptionData.data?.onConnectionRequest
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
              // The ontrack event will fire automatically when tracks are available
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
        if (request.type === 'offer' ) {
          if ( activeRequestRef.current === request.from.userId && lastOfferRef.current === request.offer) {
            console.log('WebRTC: Offer already processed')
            return
          }

          if (peerConnection.current) {
            console.log('WebRTC: Cleaning up existing connection')
            peerConnection.current.close()
            peerConnection.current = null
          }
          pendingIceCandidates.current = [] // Clear any pending candidates from previous calls
          activeRequestRef.current = request.from.userId
          lastOfferRef.current = request.offer
          setTargetUserId(request.from.userId) // Set targetUserId when receiving a call
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
    setTargetUserId(null) // Reset targetUserId when connection is reset
  }

  const doCall = async (userId: string) => {
    if (!userId || !localStream || hasTimedOutRef.current) {
      console.log('WebRTC: Cannot initialize call - missing requirements', { 
        hasUserId: !!userId, hasLocalStream: !!localStream, hasTimedOut: hasTimedOutRef.current 
      })
      return
    }

    console.log('WebRTC: Initializing connection with:', userId)
    setTargetUserId(userId)
    setConnectionStatus('calling')
    
    const pc = createPeerConnection()
    peerConnection.current = pc

    addLocalStream(pc, localStream, true)

    // Add ICE candidate handling for initiator
    setupIceCandidateHandler(pc, userId)

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
            targetUserId: userId,
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
    } catch (error) {
      logWebRTCState('WebRTC setup error', pc, error)
      setConnectionStatus('failed')
      resetConnection()
    }
  }

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
    doCall,
    resetConnection
  }
} 