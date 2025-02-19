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
    targetUser,
    setTargetUser,
    setConnectionStatus,
    setQualityRemoteWantsFromUs,
    qualityWeWantFromRemote,
    localVideoEnabled,
    localAudioEnabled,
    connectionStatus
  } = useStore()

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

      addLocalStream(pc, localStream, false, localVideoEnabled, localAudioEnabled, requestToAccept.quality)

      // Set remote description (offer)
      const offer = JSON.parse(requestToAccept.offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Create and send answer
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      await connectWithUser({
        variables: {
          input: {
            type: 'answer',
            targetUserId: requestToAccept.from.userId,
            initiatorUserId: getUserId(),
            answer: JSON.stringify(answer),
            videoEnabled: localVideoEnabled,
            audioEnabled: localAudioEnabled,
            quality: qualityWeWantFromRemote,
            callId: requestToAccept.callId
          }
        }
      })

      setupIceCandidateHandler(pc, requestToAccept.from.userId)
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
        await connectWithUser({
          variables: {
            input: {
              type: 'busy',
              targetUserId: targetUser.userId,
              initiatorUserId: getUserId(),
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
    setTargetUser(null)
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