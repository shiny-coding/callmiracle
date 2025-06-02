import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { useWebRTCCommon, CALL_USER } from './useWebRTCCommon'
import type { VideoQuality } from '@/components/VideoQualitySelector'
import { syncStore, useStore, vanillaStore } from '@/store/useStore'
import { MeetingStatus, User } from '@/generated/graphql'
import { gql } from '@apollo/client'

interface UseWebRTCCallerProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  callUser: any
  attemptReconnect: () => Promise<void>
}

const UPDATE_MEETING_STATUS = gql`
  mutation UpdateMeetingStatus($input: UpdateMeetingStatusInput!) {
    updateMeetingStatus(input: $input) {
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
    currentUser,
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
    setMeetingLastCallTime,
  } = useStore( (state: any) => ({
    currentUser: state.currentUser,
    setCallId: state.setCallId,
    setConnectionStatus: state.setConnectionStatus,
    targetUser: state.targetUser,
    meetingId: state.meetingId,
    setTargetUser: state.setTargetUser,
    qualityWeWantFromRemote: state.qualityWeWantFromRemote,
    setQualityRemoteWantsFromUs: state.setQualityRemoteWantsFromUs,
    qualityRemoteWantsFromUs: state.qualityRemoteWantsFromUs,
    localVideoEnabled: state.localVideoEnabled,
    localAudioEnabled: state.localAudioEnabled,
    setRole: state.setRole,
    connectionStatus: state.connectionStatus,
    setMeetingId: state.setMeetingId,
    setMeetingLastCallTime: state.setMeetingLastCallTime,
  })) 

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)

  const [updateMeetingStatus] = useMutation(UPDATE_MEETING_STATUS)

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
            await updateMeetingStatus({
              variables: {
                input: {
                  _id: meetingId,
                  status: MeetingStatus.Called,
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

    setMeetingId(meetingId)
    setMeetingLastCallTime(meetingLastCallTime)

    console.log('WebRTC: Initializing connection with:', user._id, isReconnect ? '(reconnecting)' : '')
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
              targetUserId: user._id,
              initiatorUserId: currentUser?._id,
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
      setupIceCandidateHandler(pc, user._id)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await callUser({
        variables: {
          input: {
            type: 'offer',
            targetUserId: user._id,
            initiatorUserId: currentUser?._id,
            offer: JSON.stringify(offer),
            videoEnabled: localVideoEnabled,
            audioEnabled: localAudioEnabled,
            quality: qualityWeWantFromRemote,
            callId: syncStore().callId // Use current callId for both reconnect and new calls
          }
        }
      })

      console.log('Offer sent with callId:', syncStore().callId)
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