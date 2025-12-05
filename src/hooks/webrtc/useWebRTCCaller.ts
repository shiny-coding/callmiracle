import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { useWebRTCCommon, clearMediaSession } from './useWebRTCCommon'
import type { VideoQuality } from '@/components/VideoQualitySelector'
import { syncStore, useStore, vanillaStore } from '@/store/useStore'
import { MeetingStatus, User } from '@/generated/graphql'
import { gql } from '@apollo/client'

interface UseWebRTCCallerProps {
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  callUser: any
  setLocalStream: (stream: MediaStream | undefined) => void
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
  setLocalStream
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
    handleConnectionStateChange,
    ensureMediaStream
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
      console.log('WebRTC: Processing call answer', {
        signalingState: pc.signalingState,
        quality: quality,
        targetUserId: targetUser?._id,
        targetUserName: targetUser?.name
      })

      if (pc.signalingState === 'have-local-offer') {
        setConnectionStatus('connecting')
        setQualityRemoteWantsFromUs(quality)
        applyLocalQuality(pc, quality)
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await dispatchPendingIceCandidates(pc)
        
        console.log('WebRTC: Answer processed successfully', { 
          targetUserId: targetUser?._id,
          targetUserName: targetUser?.name,
          quality: quality
        })
        
        // Update meeting status
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
            console.log('Meeting status updated to CALLED', { meetingId })
          } catch (err) {
            console.error('Failed to update meeting status', { 
              meetingId,
              error: err instanceof Error ? err.message : String(err)
            })
          }
        }
      } else {
        console.warn('WebRTC: Received answer in invalid signaling state', { 
          signalingState: pc.signalingState,
          targetUserId: targetUser?._id,
          targetUserName: targetUser?.name
        })
      }
    } catch (err) {
      console.error('WebRTC: Failed to process answer', { 
        error: err instanceof Error ? err.message : String(err),
        targetUserId: targetUser?._id,
        targetUserName: targetUser?.name
      })
      setConnectionStatus('failed')
    }
  }

  const doCall = async (user: User, meetingId: string | null, meetingLastCallTime: number | null) => {
    if (!user) {
      console.warn('WebRTC: Cannot initialize call - missing user')
      return
    }

    setMeetingId(meetingId)
    setMeetingLastCallTime(meetingLastCallTime)

    console.log('WebRTC: Initializing call connection', {
      targetUserId: user._id,
      targetUserName: user.name,
      meetingId: meetingId,
      hasLocalStream: !!localStream,
      localVideoEnabled,
      localAudioEnabled
    })

    setConnectionStatus('calling')
    setActive(true)
    setRole('caller')
    setTargetUser(user)

    try {
      // Ensure we have a valid media stream
      const streamToUse = await ensureMediaStream(localStream, setLocalStream, localVideoEnabled, localAudioEnabled)

      // Initialize call and get callId
      console.log('WebRTC: Initiating new call', {
        targetUserId: user._id,
        targetUserName: user.name
      })

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

      console.log('WebRTC: Call initiated successfully', {
        targetUserId: user._id,
        targetUserName: user.name,
        callId: newCallId
      })

      if ( peerConnection.current ) {
        console.log('WebRTC: Closing existing peer connection')
        peerConnection.current.close()
        peerConnection.current = null
      }

      const pc = createPeerConnection()
      peerConnection.current = pc

      console.log('WebRTC: Setting up peer connection handlers', { 
        targetUserId: user._id,
        targetUserName: user.name 
      })

      // Set up event handlers
      pc.ontrack = (event) => handleTrack(event, pc, remoteVideoRef, remoteStreamRef)
      pc.onconnectionstatechange = () => handleConnectionStateChange(pc, peerConnection)

      console.log('WebRTC: Adding local stream to peer connection')
      addLocalStream(pc, streamToUse, true, localVideoEnabled, localAudioEnabled, qualityRemoteWantsFromUs)
      setupIceCandidateHandler(pc, user._id)

      console.log('WebRTC: Creating and sending offer', { 
        targetUserId: user._id,
        targetUserName: user.name 
      })
      
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
            callId: syncStore().callId,
            meetingId: meetingId
          }
        }
      })

      console.log('WebRTC: Offer sent successfully', { 
        targetUserId: user._id,
        targetUserName: user.name,
        callId: syncStore().callId,
        videoEnabled: localVideoEnabled,
        audioEnabled: localAudioEnabled,
        quality: qualityWeWantFromRemote
      })
    } catch (error) {
      console.error('WebRTC setup error', {
        targetUserId: user._id,
        targetUserName: user.name,
        error: error instanceof Error ? error.message : String(error)
      })
      setConnectionStatus('failed')
      cleanup()
    }
  }

  const cleanup = () => {
    console.log('WebRTC: Cleaning up caller')
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    remoteStreamRef.current = null
    setActive(false)
    setCallId(null)

    // Stop local stream tracks and clear stream
    if (localStream) {
      console.log('WebRTC: Stopping local stream tracks')
      localStream.getTracks().forEach(track => {
        console.log('WebRTC: Stopping track', { kind: track.kind, id: track.id })
        track.stop()
      })
      setLocalStream(undefined)
    }

    // Clear media session to remove iOS notification panel player
    clearMediaSession()
  }

  const hangup = createHangup(cleanup)

  return {
    doCall,
    handleIceCandidate,
    cleanup,
    peerConnection,
    remoteStreamRef,
    active,
    targetUser,
    hangup,
    handleAnswer
  }
} 