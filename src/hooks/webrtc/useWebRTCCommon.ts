import { useRef } from 'react'
import { gql } from '@apollo/client'
import { QUALITY_CONFIGS, type VideoQuality } from '@/components/VideoQualitySelector'
import { syncStore, useStore, vanillaStore } from '@/store/useStore'
import { User } from '@/generated/graphql'
import { useMeetings } from '@/contexts/MeetingsContext'
import { ICE_SERVERS } from '@/constants/webrtc'
import clientLogger from '@/utils/clientLogger'

export const CALL_USER = gql`
  mutation CallUser($input: CallUserInput!) {
    callUser(input: $input) {
      type
      offer
      answer
      quality
      callId
      meetingId
      meetingLastCallTime
    }
  }
`

export const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CALLING: 'calling',
  CONNECTING: 'connecting',
  NEED_RECONNECT: 'need-reconnect',
  RECONNECTING: 'reconnecting',
  CONNECTED: 'connected',
  FAILED: 'failed',
  REJECTED: 'rejected',
  TIMEOUT: 'timeout',
  FINISHED: 'finished',
  EXPIRED: 'expired',
  RECEIVING_CALL: 'receiving-call',
  BUSY: 'busy',
  NO_ANSWER: 'no-answer'
} as const

export type ConnectionStatus = typeof ConnectionStatus[keyof typeof ConnectionStatus]

export interface IncomingRequest {
  offer: string
  iceCandidate: string
  callId: string
  quality: VideoQuality
  from: User
}

export function useWebRTCCommon(callUser: any) {
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([])
  const { setConnectionStatus, currentUser } = useStore( (state: any) => ({
    setConnectionStatus: state.setConnectionStatus,
    currentUser: state.currentUser
  }))
  const { refetchMyMeetingsWithPeers } = useMeetings()

  const handleConnectionStateChange = (pc: RTCPeerConnection, peerConnection: React.MutableRefObject<RTCPeerConnection | null>, active: boolean, attemptReconnect: () => Promise<void>) => {
    clientLogger.debug('[WebRTC] Connection state changed', {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      iceGatheringState: pc.iceGatheringState,
      signalingState: pc.signalingState,
      active
    })

    if (pc.connectionState === 'connected') {
      clientLogger.info('[WebRTC] Connection established successfully')
      setConnectionStatus(ConnectionStatus.CONNECTED)
    } else if (pc.connectionState === 'failed') {
      clientLogger.error('[WebRTC] Connection failed', {
        iceConnectionState: pc.iceConnectionState,
        active
      })
      pc.close()
      peerConnection.current = null

      console.log('WebRTC: onconnectionstatechange gone failed')
      if ( active ) {
        setConnectionStatus(ConnectionStatus.RECONNECTING)
        attemptReconnect()
      } else {
        setConnectionStatus(ConnectionStatus.FAILED)
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

        clientLogger.debug('[WebRTC] Applying quality settings', {
          quality,
          config,
          hasVideoTrack: !!videoTrack,
          trackState: videoTrack ? {
            readyState: videoTrack.readyState,
            enabled: videoTrack.enabled,
            muted: videoTrack.muted,
            id: videoTrack.id,
            label: videoTrack.label
          } : null
        })

        // Update track constraints
        if (videoTrack) {
          await videoTrack.applyConstraints({
            width: { ideal: config.width },
            height: { ideal: config.height },
            frameRate: { max: config.maxFramerate }
          })

          clientLogger.debug('[WebRTC] Track constraints applied', {
            trackId: videoTrack.id,
            settings: videoTrack.getSettings()
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

            clientLogger.debug('[WebRTC] Sender parameters updated', {
              encodings: params.encodings[0]
            })
          }
        }
      } else {
        clientLogger.warn('[WebRTC] No sender with video track found for quality update')
        console.log('WebRTC: No sender with video track found')
      }
    } catch (err) {
      clientLogger.error('[WebRTC] Failed to apply quality settings', { error: err })
      console.error('Failed to apply quality settings:', err)
      throw err
    }
  }

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
    })

    return pc
  }

  const addLocalStream = (pc: RTCPeerConnection, stream: MediaStream, isInitiator: boolean, localVideoEnabled: boolean, localAudioEnabled: boolean, localQuality: VideoQuality) => {
    const trackDetails = stream.getTracks().map(t => ({
      kind: t.kind,
      enabled: t.enabled,
      muted: t.muted,
      readyState: t.readyState,
      id: t.id,
      label: t.label,
      settings: t.getSettings()
    }))

    clientLogger.debug('[WebRTC] Adding local stream tracks', {
      isInitiator,
      localVideoEnabled,
      localAudioEnabled,
      trackCount: stream.getTracks().length,
      tracks: trackDetails,
      streamId: stream.id
    })

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
        clientLogger.debug('[WebRTC] Adding transceivers as initiator', {
          localAudioEnabled,
          localVideoEnabled
        })
        // Always add audio transceiver - either sendrecv or recvonly
        if (localAudioEnabled) {
          pc.addTransceiver('audio', { direction: 'sendrecv', streams: [stream] })
        } else {
          pc.addTransceiver('audio', { direction: 'recvonly' })
        }

        // Always add video transceiver - either sendrecv or recvonly
        if (localVideoEnabled) {
          pc.addTransceiver('video', { direction: 'sendrecv', streams: [stream] })
        } else {
          pc.addTransceiver('video', { direction: 'recvonly' })
        }
      }
    }

    for (const track of stream.getTracks()) {
      const existingSender = pc.getSenders().find(s => s.track?.kind === track.kind)

      if (existingSender) {
        clientLogger.debug('[WebRTC] Replacing existing track', {
          kind: track.kind,
          trackId: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
          oldTrackId: existingSender.track?.id
        })

        if (track.kind === 'video' && !localVideoEnabled) {
          track.enabled = false
          track.stop()
          clientLogger.debug('[WebRTC] Stopped disabled video track')
        } else if (track.kind === 'audio' && !localAudioEnabled) {
          track.enabled = false
          track.stop()
          clientLogger.debug('[WebRTC] Stopped disabled audio track')
        } else {
          existingSender.replaceTrack(track)
        }
      } else if ((track.kind === 'audio' && localAudioEnabled) || (track.kind === 'video' && localVideoEnabled)) {
        clientLogger.debug('[WebRTC] Adding new track', {
          kind: track.kind,
          trackId: track.id,
          enabled: track.enabled,
          readyState: track.readyState
        })
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
        transceiver.direction = localVideoEnabled ? 'sendrecv' : 'recvonly'
      } else if (kind === 'audio' || kind === '0') {
        transceiver.direction = localAudioEnabled ? 'sendrecv' : 'recvonly'
      }
    }
  }

  const handleTrack = (event: RTCTrackEvent, peerConnection: RTCPeerConnection, remoteVideoRef: React.RefObject<HTMLVideoElement>, remoteStreamRef: React.MutableRefObject<MediaStream | null>) => {
    if (!peerConnection) {
      clientLogger.warn('[WebRTC] handleTrack called but no peerConnection')
      return
    }

    clientLogger.debug('[WebRTC] Track event received', {
      trackKind: event.track.kind,
      trackId: event.track.id,
      trackLabel: event.track.label,
      trackReadyState: event.track.readyState,
      trackEnabled: event.track.enabled,
      trackMuted: event.track.muted,
      trackSettings: event.track.getSettings(),
      streamsCount: event.streams.length,
      streamIds: event.streams.map(s => s.id),
      currentUserId: currentUser?._id
    })

    if (!event.streams[0]?.id.includes(currentUser?._id || '')) {
      const [remoteStream] = event.streams
      if (remoteStream) {
        clientLogger.debug('[WebRTC] Remote stream received', {
          streamId: remoteStream.id,
          trackCount: remoteStream.getTracks().length,
          tracks: remoteStream.getTracks().map(t => ({
            kind: t.kind,
            id: t.id,
            label: t.label,
            readyState: t.readyState,
            enabled: t.enabled,
            muted: t.muted
          })),
          hasVideoElement: !!remoteVideoRef?.current
        })

        // Store the stream in the ref regardless of video element existence
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = remoteStream

          // Monitor remote track ended events
          remoteStream.getTracks().forEach(track => {
            track.addEventListener('ended', () => {
              clientLogger.warn('[WebRTC] Remote track ended', {
                kind: track.kind,
                id: track.id,
                label: track.label
              })
            })

            track.addEventListener('mute', () => {
              clientLogger.debug('[WebRTC] Remote track muted', {
                kind: track.kind,
                id: track.id
              })
            })

            track.addEventListener('unmute', () => {
              clientLogger.debug('[WebRTC] Remote track unmuted', {
                kind: track.kind,
                id: track.id
              })
            })
          })
        }

        // Attach to video element if it exists
        if (remoteVideoRef?.current) {
          remoteVideoRef.current.srcObject = remoteStream
          clientLogger.debug('[WebRTC] Remote stream attached to video element')
        }

        // Apply saved remote quality preference if it exists
        if (event.track.kind === 'video') {
          const qualityRemoteWantsFromUs = syncStore().qualityRemoteWantsFromUs
          clientLogger.debug('[WebRTC] Applying quality from remote preference', {
            quality: qualityRemoteWantsFromUs
          })
          applyLocalQuality(peerConnection, qualityRemoteWantsFromUs).catch(err =>
            console.error('Failed to apply initial remote quality settings:', err)
          )
        }
      }
    } else {
      clientLogger.debug('[WebRTC] Ignoring own stream in track event')
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
    const { callId } = syncStore()

    // Monitor ICE gathering state
    pc.addEventListener('icegatheringstatechange', () => {
      clientLogger.debug('[WebRTC] ICE gathering state changed', {
        iceGatheringState: pc.iceGatheringState
      })
    })

    // Monitor ICE connection state
    pc.addEventListener('iceconnectionstatechange', () => {
      clientLogger.debug('[WebRTC] ICE connection state changed', {
        iceConnectionState: pc.iceConnectionState
      })
    })

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const parsed = parseCandidate(event.candidate)
        clientLogger.debug('[WebRTC] ICE candidate generated', {
          candidate: parsed,
          callId
        })

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
          clientLogger.debug('[WebRTC] ICE candidate sent to peer')
        } catch (err) {
          clientLogger.error('[WebRTC] Failed to send ICE candidate', { error: err })
          console.error('WebRTC: Failed to send ICE candidate:', err)
        }
      } else {
        clientLogger.debug('[WebRTC] ICE gathering complete (null candidate)')
      }
    }
  }

  const handleIceCandidate = async (pc: RTCPeerConnection | null, candidate: RTCIceCandidateInit) => {
    const parsed = parseCandidate(candidate)
    clientLogger.debug('[WebRTC] Received ICE candidate from peer', {
      candidate: parsed,
      hasRemoteDescription: !!pc?.remoteDescription
    })

    try {
      if (pc?.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(candidate)
        clientLogger.debug('[WebRTC] ICE candidate added to peer connection')
      } else {
        pendingIceCandidates.current.push(candidate)
        clientLogger.debug('[WebRTC] ICE candidate buffered (no remote description yet)', {
          pendingCount: pendingIceCandidates.current.length
        })
      }
    } catch (err) {
      clientLogger.error('[WebRTC] Failed to handle ICE candidate', { error: err })
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
      const { targetUser, callId } = syncStore()
      console.log('WebRTC: Hanging up call')
      cleanup()
      setConnectionStatus(ConnectionStatus.DISCONNECTED)

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
          refetchMyMeetingsWithPeers(false)
        } catch (err) {
          console.error('Failed to send finished signal:', err)
        }
      }
    }
  }

  /**
   * Ensures a valid media stream exists, creating a new one if needed.
   * Handles cases where:
   * - No stream exists (creates new)
   * - Stream exists but tracks are ended (refreshes)
   * - Stream exists and is valid (returns existing)
   */
  const ensureMediaStream = async (
    currentStream: MediaStream | undefined,
    setLocalStream: (stream: MediaStream | undefined) => void,
    localVideoEnabled: boolean,
    localAudioEnabled: boolean
  ): Promise<MediaStream> => {
    const timestamp = Date.now()
    clientLogger.debug('[WebRTC] ensureMediaStream called', {
      timestamp,
      hasCurrentStream: !!currentStream,
      localVideoEnabled,
      localAudioEnabled,
      currentStreamId: currentStream?.id
    })

    if (currentStream) {
      const tracks = currentStream.getTracks()
      const hasEndedTracks = tracks.some(track => track.readyState === 'ended')

      // Check if existing stream matches current enabled state
      const hasVideoTrack = tracks.some(track => track.kind === 'video')
      const hasAudioTrack = tracks.some(track => track.kind === 'audio')
      const streamMatchesState =
        (localVideoEnabled === hasVideoTrack) &&
        (localAudioEnabled === hasAudioTrack)

      clientLogger.debug('[WebRTC] Existing stream analysis', {
        trackCount: tracks.length,
        tracks: tracks.map(t => ({
          kind: t.kind,
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted,
          id: t.id,
          label: t.label,
          settings: t.getSettings()
        })),
        hasEndedTracks,
        hasVideoTrack,
        hasAudioTrack,
        streamMatchesState
      })

      if (hasEndedTracks) {
        clientLogger.info('[WebRTC] LocalStream has ended tracks, creating new stream')
        console.log('WebRTC: LocalStream has ended tracks, creating new stream')
        // Stop old tracks
        tracks.forEach(track => track.stop())
      } else if (!streamMatchesState) {
        clientLogger.info('[WebRTC] LocalStream tracks do not match enabled state, creating new stream', {
          expectedVideo: localVideoEnabled,
          expectedAudio: localAudioEnabled,
          actualVideo: hasVideoTrack,
          actualAudio: hasAudioTrack
        })
        console.log('WebRTC: LocalStream tracks do not match enabled state, creating new stream')
        // Stop old tracks since we need a different configuration
        tracks.forEach(track => track.stop())
      } else {
        clientLogger.debug('[WebRTC] Using existing localStream (valid)')
        console.log('WebRTC: Using existing localStream')
        return currentStream
      }
    } else {
      clientLogger.info('[WebRTC] No localStream exists, creating new stream')
      console.log('WebRTC: No localStream exists, creating new stream')
    }

    // Create new stream - only request tracks that are enabled
    // If both audio and video are disabled, create an empty MediaStream
    if (!localVideoEnabled && !localAudioEnabled) {
      clientLogger.debug('[WebRTC] Both audio and video disabled, creating empty stream')
      console.log('WebRTC: Both audio and video disabled, creating empty stream')
      const emptyStream = new MediaStream()
      setLocalStream(emptyStream)
      return emptyStream
    }

    const selectedVideoDevice = typeof window !== 'undefined'
      ? localStorage.getItem('selectedVideoDevice') || undefined
      : undefined

    const constraints: MediaStreamConstraints = {
      video: localVideoEnabled
        ? (selectedVideoDevice ? { deviceId: selectedVideoDevice } : true)
        : false,
      audio: localAudioEnabled
    }

    clientLogger.info('[WebRTC] Requesting getUserMedia', {
      timestamp,
      constraints,
      selectedVideoDevice,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    })

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      clientLogger.info('[WebRTC] getUserMedia success', {
        timestamp,
        timeTaken: Date.now() - timestamp,
        streamId: stream.id,
        trackCount: stream.getTracks().length,
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted,
          id: t.id,
          label: t.label,
          settings: t.getSettings()
        }))
      })

      // Monitor track ended events on new stream
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          clientLogger.warn('[WebRTC] Local track ended', {
            kind: track.kind,
            id: track.id,
            label: track.label,
            streamId: stream.id
          })
        })

        track.addEventListener('mute', () => {
          clientLogger.debug('[WebRTC] Local track muted', {
            kind: track.kind,
            id: track.id
          })
        })

        track.addEventListener('unmute', () => {
          clientLogger.debug('[WebRTC] Local track unmuted', {
            kind: track.kind,
            id: track.id
          })
        })
      })

      setLocalStream(stream)
      return stream
    } catch (err) {
      clientLogger.error('[WebRTC] getUserMedia failed', {
        timestamp,
        timeTaken: Date.now() - timestamp,
        error: err,
        errorName: (err as Error)?.name,
        errorMessage: (err as Error)?.message,
        constraints
      })
      throw err
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
    handleConnectionStateChange,
    ensureMediaStream
  }
} 