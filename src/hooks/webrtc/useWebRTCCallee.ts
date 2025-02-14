import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useWebRTCCommon, CONNECT_WITH_USER } from './useWebRTCCommon'
import type { ConnectionStatus, IncomingRequest } from './useWebRTCCommon'
import type { VideoQuality } from '@/components/VideoQualitySelector'

interface UseWebRTCCalleeProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  localVideoEnabled: boolean
  localAudioEnabled: boolean
  localQuality: VideoQuality
  onStatusChange: (status: ConnectionStatus) => void
}

export function useWebRTCCallee({
  localStream,
  remoteVideoRef,
  localVideoEnabled,
  localAudioEnabled,
  localQuality,
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
  const [callId, setCallId] = useState<string | null>(null)
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
      setCallId(incomingRequest.callId)
      console.log('WebRTC: Call ID:', incomingRequest.callId)
      
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

      addLocalStream(pc, localStream, false, localVideoEnabled, localAudioEnabled, localQuality)

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
            callId: incomingRequest.callId
          }
        }
      })

      setupIceCandidateHandler(pc, incomingRequest.from.userId, connectWithUser, incomingRequest.callId)
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

  const hangup = async () => {
    console.log('WebRTC: Hanging up call')

    // Send finished signal if we have a target
    if (targetUserId) {
      try {
        await connectWithUser({
          variables: {
            input: {
              type: 'finished',
              targetUserId,
              initiatorUserId: getUserId(),
              callId
            }
          }
        })
      } catch (err) {
        console.error('Failed to send finished signal:', err)
      }
    }
    // cleanup should go after the finished signal is sent
    cleanup()
  }

  useEffect(() => {
    if (peerConnection.current && active) {
      updateMediaState(peerConnection.current, localVideoEnabled, localAudioEnabled, targetUserId!, connectWithUser, localQuality, callId)
    }
  }, [localVideoEnabled, localAudioEnabled, localQuality, active, targetUserId, callId])

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
    callId,
    hangup
  }
} 