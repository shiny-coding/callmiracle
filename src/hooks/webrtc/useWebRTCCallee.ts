import { useRef, useState } from 'react'
import { useWebRTCCommon } from './useWebRTCCommon'
import type { IncomingRequest } from './useWebRTCCommon'
import { useStore } from '@/store/useStore'

interface UseWebRTCCalleeProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  callUser: any
  attemptReconnect: () => Promise<void>
}

export function useWebRTCCallee({
  localStream,
  remoteVideoRef,
  callUser,
  attemptReconnect
}: UseWebRTCCalleeProps) {
  const {
    createPeerConnection,
    addLocalStream,
    handleTrack,
    setupIceCandidateHandler,
    handleIceCandidate,
    dispatchPendingIceCandidates,
    clearPendingCandidates,
    handleConnectionStateChange,
    createHangup
  } = useWebRTCCommon(callUser)

  const [active, setActive] = useState(false)
  const {
    currentUser,
    callId,
    setCallId,
    targetUser,
    setTargetUser,
    setConnectionStatus,
    setQualityRemoteWantsFromUs,
    qualityWeWantFromRemote,
    localVideoEnabled,
    localAudioEnabled,
  } = useStore((state) => ({
    currentUser: state.currentUser,
    callId: state.callId,
    setCallId: state.setCallId,
    targetUser: state.targetUser,
    setTargetUser: state.setTargetUser,
    setConnectionStatus: state.setConnectionStatus,
    setQualityRemoteWantsFromUs: state.setQualityRemoteWantsFromUs,
    qualityWeWantFromRemote: state.qualityWeWantFromRemote,
    localVideoEnabled: state.localVideoEnabled,
    localAudioEnabled: state.localAudioEnabled,
  }))

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null)

  const handleAcceptCall = async (reconnectRequest: IncomingRequest | null = null) => {
    const requestToAccept = reconnectRequest || incomingRequest
    if (!requestToAccept || !localStream) {
      console.log('WebRTC: Cannot accept call - missing requirements', { 
        hasIncomingRequest: !!requestToAccept, hasLocalStream: !!localStream 
      })
      return
    }

    try {
      console.log('WebRTC: Accepting call from:', requestToAccept.from.name, 'with callId:', requestToAccept.callId)
      if ( reconnectRequest ) {
        cleanup();
        setConnectionStatus('reconnecting')
      } else {
        setConnectionStatus('connecting')
      }
      setActive(true)
      setTargetUser(requestToAccept.from)
      setQualityRemoteWantsFromUs(requestToAccept.quality)
      setCallId(requestToAccept.callId)
      
      const pc = createPeerConnection()
      peerConnection.current = pc

      // Set up event handlers
      pc.ontrack = (event) => handleTrack(event, pc, remoteVideoRef, remoteStreamRef)
      pc.onconnectionstatechange = () => handleConnectionStateChange(pc, peerConnection, active, attemptReconnect)

      addLocalStream(pc, localStream, false, localVideoEnabled, localAudioEnabled, requestToAccept.quality)

      // Set remote description (offer)
      const offer = JSON.parse(requestToAccept.offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Create and send answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      await callUser({
        variables: {
          input: {
            type: 'answer',
            targetUserId: requestToAccept.from._id,
            initiatorUserId: currentUser?._id,
            answer: JSON.stringify(answer),
            videoEnabled: localVideoEnabled,
            audioEnabled: localAudioEnabled,
            quality: qualityWeWantFromRemote,
            callId: requestToAccept.callId
          }
        }
      })

      setupIceCandidateHandler(pc, requestToAccept.from._id)
      await dispatchPendingIceCandidates(pc)

      setIncomingRequest(null)
    } catch (error) {
      console.error('Error accepting call:', error)
      setConnectionStatus('failed')
      cleanup()
    }
  }

  const handleRejectCall = async () => {
    console.log('Rejecting call from:', incomingRequest?.from.name)
    setIncomingRequest(null)
    setConnectionStatus('rejected')
    setActive(false)
    setTargetUser(null)
    setCallId(null)

    if (callId && targetUser) {
      try {
        await callUser({
          variables: {
            input: {
              type: 'busy',
              targetUserId: targetUser._id,
              initiatorUserId: currentUser?._id,
              callId
            }
          }
        })
      } catch (err) {
        console.error('Failed to send busy signal:', err)
      }
    }
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