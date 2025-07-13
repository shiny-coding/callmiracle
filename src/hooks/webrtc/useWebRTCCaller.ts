import { useRef, useState, useEffect } from 'react'
import { useMutation } from '@apollo/client'
import { useWebRTCCommon, CALL_USER } from './useWebRTCCommon'
import type { VideoQuality } from '@/components/VideoQualitySelector'
import { syncStore, useStore, vanillaStore } from '@/store/useStore'
import { MeetingStatus, User } from '@/generated/graphql'
import { gql } from '@apollo/client'
import clientLogger from '@/utils/clientLogger'

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
      clientLogger.info('WebRTC: Processing call answer', { 
        signalingState: pc.signalingState,
        quality: quality,
        targetUserId: targetUser?._id,
        targetUserName: targetUser?.name
      })

      if (pc.signalingState === 'have-local-offer') {
        if (connectionStatus !== 'reconnecting') {
          setConnectionStatus('connecting')
        }
        setQualityRemoteWantsFromUs(quality)
        applyLocalQuality(pc, quality)
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await dispatchPendingIceCandidates(pc)
        
        clientLogger.info('WebRTC: Answer processed successfully', { 
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
            clientLogger.info('Meeting status updated to CALLED', { meetingId })
          } catch (err) {
            clientLogger.error('Failed to update meeting status', { 
              meetingId,
              error: err instanceof Error ? err.message : String(err)
            })
          }
        }
      } else {
        clientLogger.warn('WebRTC: Received answer in invalid signaling state', { 
          signalingState: pc.signalingState,
          targetUserId: targetUser?._id,
          targetUserName: targetUser?.name
        })
      }
    } catch (err) {
      clientLogger.error('WebRTC: Failed to process answer', { 
        error: err instanceof Error ? err.message : String(err),
        targetUserId: targetUser?._id,
        targetUserName: targetUser?.name
      })
      setConnectionStatus('failed')
    }
  }

  const doCall = async (user: User, isReconnect: boolean, meetingId: string | null, meetingLastCallTime: number | null) => {
    if (!user || !localStream) {
      clientLogger.warn('WebRTC: Cannot initialize call - missing requirements', { 
        hasUserId: !!user, 
        hasLocalStream: !!localStream,
        userId: user?._id,
        userName: user?.name
      })
      return
    }

    setMeetingId(meetingId)
    setMeetingLastCallTime(meetingLastCallTime)

    clientLogger.info('WebRTC: Initializing call connection', { 
      targetUserId: user._id,
      targetUserName: user.name,
      isReconnect: isReconnect,
      meetingId: meetingId,
      hasLocalStream: !!localStream,
      localVideoEnabled,
      localAudioEnabled
    })

    if ( !isReconnect ) {
      setConnectionStatus('calling')
    }
    setActive(true)
    setRole('caller')
    setTargetUser(user)
    
    try {
      // Initialize call and get callId if not reconnecting
      if (!isReconnect) {
        clientLogger.debug('WebRTC: Initiating new call', { 
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
        
        clientLogger.info('WebRTC: Call initiated successfully', { 
          targetUserId: user._id,
          targetUserName: user.name,
          callId: newCallId
        })
      }

      if ( peerConnection.current ) {
        clientLogger.debug('WebRTC: Closing existing peer connection')
        peerConnection.current.close()
        peerConnection.current = null
      }

      const pc = createPeerConnection()
      peerConnection.current = pc

      clientLogger.debug('WebRTC: Setting up peer connection handlers', { 
        targetUserId: user._id,
        targetUserName: user.name 
      })

      // Set up event handlers
      pc.ontrack = (event) => handleTrack(event, pc, remoteVideoRef, remoteStreamRef)
      pc.onconnectionstatechange = () => handleConnectionStateChange(pc, peerConnection, active, attemptReconnect)

      addLocalStream(pc, localStream, true, localVideoEnabled, localAudioEnabled, qualityRemoteWantsFromUs)
      setupIceCandidateHandler(pc, user._id)

      clientLogger.debug('WebRTC: Creating and sending offer', { 
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
            callId: syncStore().callId // Use current callId for both reconnect and new calls
          }
        }
      })

      clientLogger.info('WebRTC: Offer sent successfully', { 
        targetUserId: user._id,
        targetUserName: user.name,
        callId: syncStore().callId,
        videoEnabled: localVideoEnabled,
        audioEnabled: localAudioEnabled,
        quality: qualityWeWantFromRemote
      })
    } catch (error) {
      clientLogger.error('WebRTC setup error', { 
        targetUserId: user._id,
        targetUserName: user.name,
        error: error instanceof Error ? error.message : String(error),
        isReconnect
      })
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