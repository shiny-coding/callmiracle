import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useWebRTCCommon, CONNECT_WITH_USER } from './useWebRTCCommon'
import type { VideoQuality } from '@/components/VideoQualitySelector'
import { useStore } from '@/store/useStore'
import { User } from '@/generated/graphql'

interface UseWebRTCCallerProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  connectWithUser: any
}

export function useWebRTCCaller({
  localStream,
  remoteVideoRef,
  connectWithUser
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
  } = useWebRTCCommon(connectWithUser)

  const [active, setActive] = useState(false)
  const {
    callId,
    setCallId,
    setConnectionStatus,
    targetUser,
    setTargetUser,
    qualityWeWantFromRemote,
    setQualityRemoteWantsFromUs,
    qualityRemoteWantsFromUs,
    localVideoEnabled,
    localAudioEnabled,
    setRole,
    connectionStatus
  } = useStore()

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)

  const handleAnswer = async (pc: RTCPeerConnection, quality: VideoQuality, answer: RTCSessionDescriptionInit) => {
    try {
      if (pc.signalingState === 'have-local-offer') {
        if (connectionStatus !== 'reconnecting') {
          setConnectionStatus('connecting')
        }
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

  const doCall = async (user: User, isReconnect: boolean = false) => {
    if (!user || !localStream ) {
      console.log('WebRTC: Cannot initialize call - missing requirements', { 
        hasUserId: !!user, hasLocalStream: !!localStream 
      })
      return
    }

    console.log('WebRTC: Initializing connection with:', user.userId, isReconnect ? '(reconnecting)' : '')
    if ( !isReconnect ) {
      setConnectionStatus('calling')
    }
    setActive(true)
    setRole('caller')
    setTargetUser(user)
    
    try {
      // Initialize call and get callId if not reconnecting
      if (!isReconnect) {
        const initResult = await connectWithUser({
          variables: {
            input: {
              type: 'initiate',
              targetUserId: user.userId,
              initiatorUserId: getUserId()
            }
          }
        })
        const newCallId = initResult.data?.connectWithUser?.callId
        if (!newCallId) {
          throw new Error('Failed to get callId from initiate')
        }
        setCallId(newCallId)
      }

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
      setupIceCandidateHandler(pc, user.userId)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await connectWithUser({
        variables: {
          input: {
            type: 'offer',
            targetUserId: user.userId,
            initiatorUserId: getUserId(),
            offer: JSON.stringify(offer),
            videoEnabled: localVideoEnabled,
            audioEnabled: localAudioEnabled,
            quality: qualityWeWantFromRemote,
            callId: useStore.getState().callId // Use current callId for both reconnect and new calls
          }
        }
      })

      console.log('Offer sent with callId:', useStore.getState().callId)
    } catch (error) {
      console.error('WebRTC setup error:', error)
      setConnectionStatus('failed')
      cleanup()
    }
  }

  const cleanup = () => {
    console.log('Cleaning up caller')
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    remoteStreamRef.current = null
    setActive(false)
    setTargetUser(null)
    setCallId(null)
  }

  const hangup = createHangup(cleanup)

  return {
    doCall,
    handleIceCandidate,
    cleanup,
    peerConnection,
    active,
    targetUser,
    hangup,
    handleAnswer
  }
} 