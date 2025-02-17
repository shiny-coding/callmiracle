import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useWebRTCCommon, CONNECT_WITH_USER } from './useWebRTCCommon'
import type { ConnectionStatus, IncomingRequest } from './useWebRTCCommon'
import type { VideoQuality } from '@/components/VideoQualitySelector'
import { useStore } from '@/store/useStore'

interface UseWebRTCCalleeProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  connectWithUser: any
}

export function useWebRTCCallee({
  localStream,
  remoteVideoRef,
  connectWithUser
}: UseWebRTCCalleeProps) {
  const {
    createPeerConnection,
    addLocalStream,
    handleTrack,
    setupIceCandidateHandler,
    handleIceCandidate,
    dispatchPendingIceCandidates,
    clearPendingCandidates,
    createHangup
  } = useWebRTCCommon(connectWithUser)

  const [active, setActive] = useState(false)
  const {
    callId,
    setCallId,
    targetUserId,
    setTargetUserId,
    setConnectionStatus,
    setQualityRemoteWantsFromUs,
    qualityWeWantFromRemote,
    localVideoEnabled,
    localAudioEnabled } = useStore()

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null)

  const handleAcceptCall = async () => {
    if (!incomingRequest || !localStream) return

    try {
      console.log('WebRTC: Accepting call from:', incomingRequest.from.name, 'with callId:', incomingRequest.callId)
      setConnectionStatus('connecting')
      setActive(true)
      setTargetUserId(incomingRequest.from.userId)
      setQualityRemoteWantsFromUs(incomingRequest.quality)
      setCallId(incomingRequest.callId)
      
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
          setConnectionStatus('failed')
          setActive(false)
        }
      }

      addLocalStream(pc, localStream, false, localVideoEnabled, localAudioEnabled, incomingRequest.quality)

      // Set remote description (offer)
      const offer = JSON.parse(incomingRequest.offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Create and send answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      await connectWithUser({
        variables: {
          input: {
            type: 'answer',
            targetUserId: incomingRequest.from.userId,
            initiatorUserId: getUserId(),
            answer: JSON.stringify(answer),
            videoEnabled: localVideoEnabled,
            audioEnabled: localAudioEnabled,
            quality: qualityWeWantFromRemote,
            callId: incomingRequest.callId
          }
        }
      })

      setupIceCandidateHandler(pc, incomingRequest.from.userId)
      await dispatchPendingIceCandidates(pc)

      setIncomingRequest(null)
    } catch (error) {
      console.error('Error accepting call:', error)
      setConnectionStatus('failed')
      cleanup()
    }
  }

  const handleRejectCall = () => {
    console.log('Rejecting call from:', incomingRequest?.from.name)
    setIncomingRequest(null)
    setConnectionStatus('rejected')
    setActive(false)
    setTargetUserId(null)
    setCallId(null)
  }

  const cleanup = () => {
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    clearPendingCandidates()
    remoteStreamRef.current = null
    setIncomingRequest(null)
    setActive(false)
    setTargetUserId(null)
    setCallId(null)
  }

  const hangup = createHangup(cleanup)

  return {
    incomingRequest,
    setIncomingRequest,
    handleAcceptCall,
    handleRejectCall,
    handleIceCandidate,
    cleanup,
    peerConnection,
    active,
    hangup
  }
} 