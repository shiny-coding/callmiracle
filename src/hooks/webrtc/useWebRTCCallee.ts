import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useWebRTCCommon, CONNECT_WITH_USER } from './useWebRTCCommon'
import type { ConnectionStatus, IncomingRequest } from './useWebRTCCommon'

interface UseWebRTCCalleeProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  localVideoEnabled: boolean
  localAudioEnabled: boolean
  onStatusChange: (status: ConnectionStatus) => void
}

export function useWebRTCCallee({
  localStream,
  remoteVideoRef,
  localVideoEnabled,
  localAudioEnabled,
  onStatusChange
}: UseWebRTCCalleeProps) {
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
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null)

  const handleAcceptCall = async () => {
    if (!incomingRequest || !localStream) return

    try {
      console.log('WebRTC: Accepting call from:', incomingRequest.from.name)
      onStatusChange('connecting')
      setActive(true)
      setTargetUserId(incomingRequest.from.userId)
      
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
          setActive(false)
        }
      }

      addLocalStream(pc, localStream, false, localVideoEnabled, localAudioEnabled)

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
            answer: JSON.stringify(answer)
          }
        }
      })

      setupIceCandidateHandler(pc, incomingRequest.from.userId, connectWithUser)
      await dispatchPendingIceCandidates(pc)

      setIncomingRequest(null)
    } catch (error) {
      console.error('Error accepting call:', error)
      onStatusChange('failed')
      cleanup()
    }
  }

  const handleRejectCall = () => {
    console.log('Rejecting call from:', incomingRequest?.from.name)
    setIncomingRequest(null)
    onStatusChange('rejected')
    setActive(false)
    setTargetUserId(null)
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
  }

  const hangup = createHangup(
    peerConnection, 
    targetUserId, 
    cleanup, 
    connectWithUser
  )

  useEffect(() => {
    if (peerConnection.current && active) {
      updateMediaState(peerConnection.current, localVideoEnabled, localAudioEnabled)
    }
  }, [localVideoEnabled, localAudioEnabled, active])

  return {
    incomingRequest,
    setIncomingRequest,
    handleAcceptCall,
    handleRejectCall,
    handleIceCandidate,
    cleanup,
    peerConnection,
    active,
    targetUserId,
    hangup
  }
} 