import { useEffect, useRef, useState } from 'react'
import { useWebRTCCommon, ConnectionStatus, clearMediaSession } from './useWebRTCCommon'
import type { IncomingRequest } from './useWebRTCCommon'
import { useStore } from '@/store/useStore'

interface UseWebRTCCalleeProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  callUser: any
  setLocalStream: (stream: MediaStream | undefined) => void
  onRemoteStreamUpdated?: () => void
}

export function useWebRTCCallee({
  localStream,
  remoteVideoRef,
  callUser,
  setLocalStream,
  onRemoteStreamUpdated
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
    createHangup,
    ensureMediaStream
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
  const pendingAcceptRef = useRef(false)

  const handleAcceptCall = async () => {
    if (!incomingRequest) {
      console.log('WebRTC: Accept requested but missing incoming request - deferring until offer arrives')
      pendingAcceptRef.current = true
      return
    }

    try {
      console.log('WebRTC: Accepting call from:', incomingRequest.from.name, 'with callId:', incomingRequest.callId)
      pendingAcceptRef.current = false

      setConnectionStatus(ConnectionStatus.CONNECTING)
      setActive(true)
      setTargetUser(incomingRequest.from)
      setQualityRemoteWantsFromUs(incomingRequest.quality)
      setCallId(incomingRequest.callId)

      // Ensure we have a valid media stream
      const streamToUse = await ensureMediaStream(localStream, setLocalStream, localVideoEnabled, localAudioEnabled)

      const pc = createPeerConnection()
      peerConnection.current = pc

      // Set up event handlers
      pc.ontrack = (event) => handleTrack(event, pc, remoteVideoRef, remoteStreamRef, onRemoteStreamUpdated)
      pc.onconnectionstatechange = () => handleConnectionStateChange(pc, peerConnection)

      addLocalStream(pc, streamToUse, false, localVideoEnabled, localAudioEnabled, incomingRequest.quality)

      // Set remote description (offer)
      const offer = JSON.parse(incomingRequest.offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Create and send answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      await callUser({
        variables: {
          input: {
            type: 'answer',
            targetUserId: incomingRequest.from._id,
            initiatorUserId: currentUser?._id,
            answer: JSON.stringify(answer),
            videoEnabled: localVideoEnabled,
            audioEnabled: localAudioEnabled,
            quality: qualityWeWantFromRemote,
            callId: incomingRequest.callId
          }
        }
      })

      setupIceCandidateHandler(pc, incomingRequest.from._id)
      await dispatchPendingIceCandidates(pc)

      setIncomingRequest(null)
    } catch (error) {
      console.error('Error accepting call:', error)
      setConnectionStatus(ConnectionStatus.FAILED)
      cleanup()
    }
  }

  const handleRejectCall = async () => {
    console.log('Rejecting call from:', incomingRequest?.from.name)
    pendingAcceptRef.current = false
    setIncomingRequest(null)
    setConnectionStatus(ConnectionStatus.REJECTED)
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

  useEffect(() => {
    if (incomingRequest && pendingAcceptRef.current) {
      console.log('WebRTC: Incoming request arrived after accept click, auto-accepting')
      handleAcceptCall()
    }
  }, [incomingRequest])

  const cleanup = () => {
    console.log('WebRTC: Cleaning up callee')
    pendingAcceptRef.current = false
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    clearPendingCandidates()
    remoteStreamRef.current = null
    setIncomingRequest(null)
    setActive(false)
    setCallId(null)

    // Stop local stream tracks and clear stream
    if (localStream) {
      console.log('WebRTC: Stopping local stream tracks')
      localStream.getTracks().forEach(track => {
        console.log('WebRTC: Stopping track:', track.kind, track.id)
        track.stop()
      })
      setLocalStream(undefined)
    }

    // Clear media session to remove iOS notification panel player
    clearMediaSession()
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
    remoteStreamRef,
    active,
    hangup
  }
} 
