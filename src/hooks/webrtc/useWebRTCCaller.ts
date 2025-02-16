import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useWebRTCCommon, CONNECT_WITH_USER, CONNECTION_TIMEOUT_MS } from './useWebRTCCommon'
import type { ConnectionStatus } from './useWebRTCCommon'
import type { VideoQuality } from '@/components/VideoQualitySelector'
import { useStore } from '@/store/useStore'

interface UseWebRTCCallerProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
}

export function useWebRTCCaller({
  localStream,
  remoteVideoRef
}: UseWebRTCCallerProps) {
  const {
    createPeerConnection,
    addLocalStream,
    handleTrack,
    setupIceCandidateHandler,
    handleIceCandidate,
    createHangup,
    dispatchPendingIceCandidates,
    applyLocalQuality
  } = useWebRTCCommon()

  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const [active, setActive] = useState(false)
  const {
    callId,
    setCallId,
    setConnectionStatus,
    targetUserId,
    setTargetUserId,
    qualityWeWantFromRemote,
    setQualityRemoteWantsFromUs,
    qualityRemoteWantsFromUs,
    localVideoEnabled,
    localAudioEnabled } = useStore()

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const answerTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasTimedOutRef = useRef(false)

  const handleAnswer = async (pc: RTCPeerConnection, quality: VideoQuality, answer: RTCSessionDescriptionInit) => {
    try {
      if (pc.signalingState === 'have-local-offer') {
        setQualityRemoteWantsFromUs(quality)
        applyLocalQuality(pc, quality)
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await dispatchPendingIceCandidates(pc)
      } else {
        console.warn('WebRTC: Received answer in invalid state:', pc.signalingState)
      }
    } catch (err) {
      console.error('WebRTC: Failed to process answer:', err)
      setConnectionStatus('failed')
    }
  }

  const doCall = async (userId: string, isReconnect: boolean = false) => {
    if (!userId || !localStream || hasTimedOutRef.current) {
      console.log('WebRTC: Cannot initialize call - missing requirements', { 
        hasUserId: !!userId, hasLocalStream: !!localStream, hasTimedOut: hasTimedOutRef.current 
      })
      return
    }

    console.log('WebRTC: Initializing connection with:', userId, isReconnect ? '(reconnecting)' : '')
    setConnectionStatus(isReconnect ? 'connecting' : 'calling')
    setActive(true)
    setTargetUserId(userId)
    
    const pc = createPeerConnection()
    peerConnection.current = pc

    // Set up event handlers
    pc.ontrack = (event) => handleTrack(event, pc, remoteVideoRef, remoteStreamRef)
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected')
      } else if (pc.connectionState === 'failed') {
        pc.close()
        peerConnection.current = null
        console.log('WebRTC: onconnectionstatechange -> failed')
        setConnectionStatus('failed')
      }
    }

    addLocalStream(pc, localStream, true, localVideoEnabled, localAudioEnabled, qualityRemoteWantsFromUs)
    setupIceCandidateHandler(pc, userId, connectWithUser)

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const result = await connectWithUser({
        variables: {
          input: {
            type: 'offer',
            targetUserId: userId,
            initiatorUserId: getUserId(),
            offer: JSON.stringify(offer),
            videoEnabled: localVideoEnabled,
            audioEnabled: localAudioEnabled,
            quality: qualityWeWantFromRemote,
            callId: isReconnect ? callId : undefined // Only send callId if reconnecting
          }
        }
      })
      
      if (!isReconnect) {
        const newCallId = result.data?.connectWithUser?.callId
        setCallId(newCallId)
      }

      console.log('Offer sent with callId:', useStore.getState().callId)
      
      // Only set timeout for new calls, not reconnections
      if (!isReconnect) {
        clearTimeout(answerTimeoutRef.current as any)
        answerTimeoutRef.current = setTimeout(() => {
          if (pc.signalingState !== 'stable') {
            console.log('No answer received within timeout period')
            hasTimedOutRef.current = true
            setConnectionStatus('timeout')
            cleanup()
          }
        }, CONNECTION_TIMEOUT_MS)
      }
    } catch (error) {
      console.error('WebRTC setup error:', error)
      setConnectionStatus('failed')
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
    remoteStreamRef.current = null
    setActive(false)
    setTargetUserId(null)
    setCallId(null)
    hasTimedOutRef.current = false
  }

  const hangup = createHangup(peerConnection, targetUserId, cleanup, connectWithUser)

  return {
    doCall,
    handleIceCandidate,
    cleanup,
    peerConnection,
    active,
    targetUserId,
    hangup,
    handleAnswer
  }
} 