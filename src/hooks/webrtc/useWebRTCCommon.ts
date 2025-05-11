import { useRef } from 'react'
import { gql } from '@apollo/client'
import { QUALITY_CONFIGS, type VideoQuality } from '@/components/VideoQualitySelector'
import { useStore } from '@/store/useStore'
import { User } from '@/generated/graphql'
import { useMeetings } from '@/contexts/MeetingsContext'

export const CALL_USER = gql`
  mutation CallUser($input: CallUserInput!) {
    callUser(input: $input) {
      type
      offer
      answer
      targetUserId
      initiatorUserId
      quality
      callId
      meetingId
      meetingLastCallTime
    }
  }
`

export type ConnectionStatus = 
  | 'disconnected' 
  | 'calling' 
  | 'connecting'
  | 'need-reconnect'
  | 'reconnecting'
  | 'connected' 
  | 'failed' 
  | 'rejected' 
  | 'timeout' 
  | 'finished'
  | 'expired'
  | 'receiving-call'
  | 'busy'
  | 'no-answer'

export interface IncomingRequest {
  offer: string
  iceCandidate: string
  callId: string
  quality: VideoQuality
  from: User
}

export function useWebRTCCommon(callUser: any) {
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([])
  const { setConnectionStatus, currentUser } = useStore()
  const { refetchMeetingsWithPeers } = useMeetings()

  const handleConnectionStateChange = (pc: RTCPeerConnection, peerConnection: React.MutableRefObject<RTCPeerConnection | null>, active: boolean, attemptReconnect: () => Promise<void>) => {
    if (pc.connectionState === 'connected') {
      setConnectionStatus('connected')
    } else if (pc.connectionState === 'failed') {
      pc.close()
      peerConnection.current = null

      console.log('WebRTC: onconnectionstatechange gone failed')
      if ( active ) {
        setConnectionStatus('reconnecting')
        attemptReconnect()
      } else {
        setConnectionStatus('failed')
      }
    }
  }

  const applyLocalQuality = async (peerConnection: RTCPeerConnection, quality: VideoQuality) => {
    try {
      const transceiver = peerConnection.getTransceivers().find(t => t.receiver.track?.kind === 'video')
      if (transceiver && transceiver.sender) {
        const sender = transceiver.sender
        const videoTrack = sender.track
        const config = QUALITY_CONFIGS[quality]
        // Update track constraints
        if (videoTrack) {
          await videoTrack.applyConstraints({
            width: { ideal: config.width },
            height: { ideal: config.height },
            frameRate: { max: config.maxFramerate }
          })
        }

        // Update sender parameters if available
        if (sender) {
          const params = sender.getParameters()
          if (!params.encodings) {
            params.encodings = [{}]
          }
          if (params.encodings.length ) {
            // checking because when closing the call, encodings may be empty            
            params.encodings[0].maxBitrate = config.maxBitrate
            params.encodings[0].maxFramerate = config.maxFramerate
            params.encodings[0].scaleResolutionDownBy = 1920 / config.width
            await sender.setParameters(params)
          }
        }
      } else {
        console.log('WebRTC: No sender with video track found')
      }
    } catch (err) {
      console.error('Failed to apply quality settings:', err)
      throw err
    }
  }

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
    })

    return pc
  }

  const addLocalStream = (pc: RTCPeerConnection, stream: MediaStream, isInitiator: boolean, localVideoEnabled: boolean, localAudioEnabled: boolean, localQuality: VideoQuality) => {
    console.log('WebRTC: Adding local stream tracks:', {
      trackCount: stream.getTracks().length,
      tracks: stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted
      }))
    })

    if (isInitiator) {
      if (!pc.getTransceivers().length) {
        if (localAudioEnabled) {
          pc.addTransceiver('audio', { direction: 'sendrecv', streams: [stream] })
        }
        if (localVideoEnabled) {
          pc.addTransceiver('video', { direction: 'sendrecv', streams: [stream] })
        }
      }
    }

    for (const track of stream.getTracks()) {
      const existingSender = pc.getSenders().find(s => s.track?.kind === track.kind)
      if (existingSender) {
        if (track.kind === 'video' && !localVideoEnabled) {
          track.enabled = false
          track.stop()
        } else if (track.kind === 'audio' && !localAudioEnabled) {
          track.enabled = false
          track.stop()
        } else {
          existingSender.replaceTrack(track)
        }
      } else if ((track.kind === 'audio' && localAudioEnabled) || (track.kind === 'video' && localVideoEnabled)) {
        pc.addTrack(track, stream)
      }
    }

    configureTransceivers(pc, localVideoEnabled, localAudioEnabled)
    applyLocalQuality(pc, localQuality).catch(err => 
      console.error('Failed to apply initial remote quality settings:', err)
    )
  }

  const configureTransceivers = (pc: RTCPeerConnection, localVideoEnabled: boolean, localAudioEnabled: boolean) => {
    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.sender.track?.kind || transceiver.mid
      if (kind === 'video' || kind === '1') {
        transceiver.direction = localVideoEnabled ? 'sendrecv' : 'inactive'
      } else if (kind === 'audio' || kind === '0') {
        transceiver.direction = localAudioEnabled ? 'sendrecv' : 'inactive'
      }
    }
  }

  const handleTrack = (event: RTCTrackEvent, peerConnection: RTCPeerConnection, remoteVideoRef: React.RefObject<HTMLVideoElement>, remoteStreamRef: React.MutableRefObject<MediaStream | null>) => {
    if (!peerConnection) {
      console.log('WebRTC: OnTrack, but no peer connection found')
      return
    }
    
    console.log('WebRTC: OnTrack', event)
    if (!event.streams[0]?.id.includes(currentUser?._id || '')) {
      const [remoteStream] = event.streams
      if (remoteStream && remoteVideoRef?.current) {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = remoteStream
        }
        remoteVideoRef.current.srcObject = remoteStream
        console.log('Received first remote track: ' + event.track.kind)
        // Apply saved remote quality preference if it exists
        if (event.track.kind === 'video') {
          const qualityRemoteWantsFromUs = useStore.getState().qualityRemoteWantsFromUs
          applyLocalQuality(peerConnection, qualityRemoteWantsFromUs).catch(err => 
            console.error('Failed to apply initial remote quality settings:', err)
          )
        }
      }
    } else {
      console.log('Ignored local track: ' + event.track.kind)
    }
  }

  const parseCandidate = (candidate: RTCIceCandidateInit) => {
    if (!candidate.candidate) return null
    const parts = candidate.candidate.split(' ')
    return {
      foundation: parts[0].split(':')[1],
      component: parts[1],
      protocol: parts[2].toLowerCase(),
      priority: parseInt(parts[3], 10),
      ip: parts[4],
      port: parseInt(parts[5], 10),
      type: parts[7],
    }
  }

  const setupIceCandidateHandler = (pc: RTCPeerConnection, targetUserId: string) => {
    const { callId } = useStore.getState()
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await callUser({
            variables: {
              input: {
                type: 'ice-candidate',
                targetUserId,
                initiatorUserId: currentUser?._id,
                iceCandidate: JSON.stringify(event.candidate),
                callId: callId || undefined // Only send if we have a callId
              }
            }
          })
        } catch (err) {
          console.error('WebRTC: Failed to send ICE candidate:', err)
        }
      }
    }
  }

  const handleIceCandidate = async (pc: RTCPeerConnection | null, candidate: RTCIceCandidateInit) => {
    try {
      if (pc?.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(candidate)
      } else {
        pendingIceCandidates.current.push(candidate)
      }
    } catch (err) {
      console.error('WebRTC: Failed to handle ICE candidate:', err)
    }
  }

  const dispatchPendingIceCandidates = async (pc: RTCPeerConnection) => {
    if (pendingIceCandidates.current.length > 0) {
      console.log('WebRTC: Processing pending ICE candidates:', pendingIceCandidates.current.length)
      for (const candidate of pendingIceCandidates.current) {
        await pc.addIceCandidate(candidate)
      }
      pendingIceCandidates.current = []
    }
  }

  const clearPendingCandidates = () => {
    pendingIceCandidates.current = []
  }

  const sendWantedMediaStateImpl = (
    pc: RTCPeerConnection, 
    localVideoEnabled: boolean, 
    localAudioEnabled: boolean, 
    targetUserId: string, 
    qualityWeWantFromRemote: VideoQuality,
    callId?: string | null
  ) => {

    const senders = pc.getSenders()
    for (const sender of senders) {
      const track = sender.track
      if (!track) continue
      if (track.kind === 'video') {
        track.enabled = localVideoEnabled
      } else if (track.kind === 'audio') {
        track.enabled = localAudioEnabled
      }
    }
    
    // Update transceivers
    configureTransceivers(pc, localVideoEnabled, localAudioEnabled)

    // Notify peer about track changes
    console.log('WebRTC: Updating media state:', {
      videoEnabled: localVideoEnabled,
      audioEnabled: localAudioEnabled,
      quality: qualityWeWantFromRemote,
      callId
    })
    callUser({
      variables: {
        input: {
          type: 'updateMediaState',
          targetUserId,
          initiatorUserId: currentUser?._id,
          videoEnabled: localVideoEnabled,
          audioEnabled: localAudioEnabled,
          quality: qualityWeWantFromRemote,
          callId
        }
      }
    }).catch((err: any) => {
      console.error('Failed to send track changes:', err)
    })
  }

  const createHangup = (
    cleanup: () => void,
  ) => {
    return async () => {
      const { targetUser, callId } = useStore.getState()
      console.log('WebRTC: Hanging up call')
      cleanup()
      setConnectionStatus('disconnected')

      // Send finished signal if we have a target
      if (targetUser) {
        try {
          await callUser({
            variables: {
              input: {
                type: 'finished',
                targetUserId: targetUser._id,
                initiatorUserId: currentUser?._id,
                callId
              }
            }
          })
          console.log('refetching meetings')
          refetchMeetingsWithPeers()
        } catch (err) {
          console.error('Failed to send finished signal:', err)
        }
      }
    }
  }

  return {
    createPeerConnection,
    addLocalStream,
    handleTrack,
    parseCandidate,
    setupIceCandidateHandler,
    handleIceCandidate,
    dispatchPendingIceCandidates,
    clearPendingCandidates,
    sendWantedMediaStateImpl,
    createHangup,
    applyLocalQuality,
    handleConnectionStateChange
  }
} 