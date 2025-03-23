import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useWebRTCCommon, CONNECT_WITH_USER } from './useWebRTCCommon'
import type { VideoQuality } from '@/components/VideoQualitySelector'
import { useStore } from '@/store/useStore'
import { Meeting, User } from '@/generated/graphql'
import { gql } from '@apollo/client'

interface UseWebRTCCallerProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  callUser: any
  attemptReconnect: () => Promise<void>
}

const UPDATE_MEETING_STATUS = gql`
  mutation UpdateMeetingLastCall($input: UpdateMeetingLastCallInput!) {
    updateMeetingLastCall(input: $input) {
      _id
      status
      lastCallTime
    }
  }
`

export function useWebRTCCaller({
  localStream,
  remoteVideoRef,
  callUser,
  attemptReconnect
}: UseWebRTCCallerProps) {
  const {
    createPeerConnection,
    addLocalStream,
    handleTrack,
    setupIceCandidateHandler,
    handleIceCandidate,
    createHangup,
    dispatchPendingIceCandidates,
    applyLocalQuality,
    handleConnectionStateChange
  } = useWebRTCCommon(callUser)

  const [active, setActive] = useState(false)
  const {
    setCallId,
    setConnectionStatus,
    targetUser,
    meetingId,
    setTargetUser,
    qualityWeWantFromRemote,
    setQualityRemoteWantsFromUs,
    qualityRemoteWantsFromUs,
    localVideoEnabled,
    localAudioEnabled,
    setRole,
    connectionStatus,
    setMeetingId,
    setMeetingLastCallTime
  } = useStore()

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)

  const [updateMeetingLastCall] = useMutation(UPDATE_MEETING_STATUS)

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
        
        // keep this a bit
        if (meetingId) {
          try {
            await updateMeetingLastCall({
              variables: {
                input: {
                  _id: meetingId,
                  status: "CALLED",
                  lastCallTime: Date.now()
                }
              }
            })
            console.log(`Updated meeting ${meetingId} status to CALLED and lastCallTime to now`)
          } catch (err) {
            console.error('Failed to update meeting status:', err)
          }
        }
      } else {
        console.warn('WebRTC: Received answer in invalid state:', pc.signalingState)
      }
    } catch (err) {
      console.error('WebRTC: Failed to process answer:', err)
      setConnectionStatus('failed')
    }
  }

  const doCall = async (user: User, isReconnect: boolean, meetingId: string | null, meetingLastCallTime: number | null) => {
    if (!user || !localStream) {
      console.log('WebRTC: Cannot initialize call - missing requirements', { 
        hasUserId: !!user, hasLocalStream: !!localStream 
      })
      return
    }

    if (meetingId) {
      setMeetingId(meetingId)
      setMeetingLastCallTime(meetingLastCallTime)
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
        const initResult = await callUser({
          variables: {
            input: {
              type: 'initiate',
              targetUserId: user.userId,
              initiatorUserId: getUserId(),
              meetingId,
              meetingLastCallTime
            }
          }
        })
        const newCallId = initResult.data?.callUser?.callId
        if (!newCallId) {
          throw new Error('Failed to get callId from initiate')
        }
        setCallId(newCallId)
      }

      if ( peerConnection.current ) {
        console.log('WebRTC: Closing existing peer connection')
        peerConnection.current.close()
        peerConnection.current = null
      }

      const pc = createPeerConnection()
      peerConnection.current = pc

      // Set up event handlers
      pc.ontrack = (event) => handleTrack(event, pc, remoteVideoRef, remoteStreamRef)
      pc.onconnectionstatechange = () => handleConnectionStateChange(pc, peerConnection, active, attemptReconnect)

      addLocalStream(pc, localStream, true, localVideoEnabled, localAudioEnabled, qualityRemoteWantsFromUs)
      setupIceCandidateHandler(pc, user.userId)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await callUser({
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
    setCallId(null)
    setMeetingId(null)
    setMeetingLastCallTime(null)
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