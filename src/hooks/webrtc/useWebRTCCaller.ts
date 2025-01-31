import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useWebRTCCommon, CONNECT_WITH_USER, CONNECTION_TIMEOUT_MS } from './useWebRTCCommon'
import type { ConnectionStatus } from './useWebRTCCommon'

interface UseWebRTCCallerProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  localVideoEnabled: boolean
  localAudioEnabled: boolean
  onStatusChange: (status: ConnectionStatus) => void
}

export function useWebRTCCaller({
  localStream,
  remoteVideoRef,
  localVideoEnabled,
  localAudioEnabled,
  onStatusChange
}: UseWebRTCCallerProps) {
  const {
    createPeerConnection,
    addLocalStream,
    handleTrack,
    setupIceCandidateHandler,
    handleIceCandidate,
    dispatchPendingIceCandidates,
    clearPendingCandidates,
    updateMediaState,
    createHangup
  } = useWebRTCCommon()

  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const [active, setActive] = useState(false)
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const answerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasTimedOutRef = useRef<boolean>(false)
  const remoteStreamRef = useRef<MediaStream | null>(null)

  const handleAnswer = async (pc: RTCPeerConnection, answer: RTCSessionDescriptionInit) => {
    try {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await dispatchPendingIceCandidates(pc)
      } else {
        console.warn('WebRTC: Received answer in invalid state:', pc.signalingState)
      }
    } catch (err) {
      console.error('WebRTC: Failed to process answer:', err)
      onStatusChange('failed')
    }
  }

  const doCall = async (userId: string) => {
    if (!userId || !localStream || hasTimedOutRef.current) {
      console.log('WebRTC: Cannot initialize call - missing requirements', { 
        hasUserId: !!userId, hasLocalStream: !!localStream, hasTimedOut: hasTimedOutRef.current 
      })
      return
    }

    console.log('WebRTC: Initializing connection with:', userId)
    onStatusChange('calling')
    setActive(true)
    setTargetUserId(userId)
    
    const pc = createPeerConnection()
    peerConnection.current = pc

    // Set up event handlers
    pc.ontrack = (event) => handleTrack(event, pc, remoteVideoRef, remoteStreamRef)
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        onStatusChange('connected')
      } else if (pc.connectionState === 'failed') {
        pc.close()
        peerConnection.current = null
        onStatusChange('failed')
      }
    }

    addLocalStream(pc, localStream, true, localVideoEnabled, localAudioEnabled)
    setupIceCandidateHandler(pc, userId, connectWithUser)

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await connectWithUser({
        variables: {
          input: {
            type: 'offer',
            targetUserId: userId,
            initiatorUserId: getUserId(),
            offer: JSON.stringify(offer),
            videoEnabled: localVideoEnabled,
            audioEnabled: localAudioEnabled
          }
        }
      })

      console.log('Offer sent, waiting for answer via subscription')
      
      clearTimeout(answerTimeoutRef.current as any)
      answerTimeoutRef.current = setTimeout(() => {
        if (pc.signalingState !== 'stable') {
          console.log('No answer received within timeout period')
          hasTimedOutRef.current = true
          onStatusChange('timeout')
          cleanup()
        }
      }, CONNECTION_TIMEOUT_MS)
    } catch (error) {
      console.error('WebRTC setup error')
      onStatusChange('failed')
      cleanup()
    }
  }

  const cleanup = () => {
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    clearTimeout(answerTimeoutRef.current as any)
    answerTimeoutRef.current = null
    clearPendingCandidates()
    hasTimedOutRef.current = false
    remoteStreamRef.current = null
    setActive(false)
    setTargetUserId(null)
  }

  const hangup = createHangup(peerConnection, targetUserId, cleanup, connectWithUser)

  useEffect(() => {
    if (peerConnection.current && active) {
      updateMediaState(peerConnection.current, localVideoEnabled, localAudioEnabled, targetUserId!, connectWithUser)
    }
  }, [localVideoEnabled, localAudioEnabled, active, targetUserId])

  return {
    doCall,
    handleAnswer,
    handleIceCandidate,
    cleanup,
    peerConnection,
    active,
    targetUserId,
    hangup,
  }
} 