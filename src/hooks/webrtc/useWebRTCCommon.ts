import { useRef } from 'react'
import { gql } from '@apollo/client'
import { QUALITY_CONFIGS, type VideoQuality } from '@/components/VideoQualitySelector'
import { syncStore, useStore, vanillaStore } from '@/store/useStore'
import { User } from '@/generated/graphql'
import { useMeetings } from '@/contexts/MeetingsContext'
import { ICE_SERVERS } from '@/constants/webrtc'
import clientLogger from '@/utils/clientLogger'

/**
 * Clear the browser's media session to remove the media player from iOS notification panel
 */
export function clearMediaSession() {
  if ('mediaSession' in navigator) {
    try {
      // Clear metadata
      navigator.mediaSession.metadata = null
      // Set playback state to none
      navigator.mediaSession.playbackState = 'none'
      // Clear action handlers
      const actions: MediaSessionAction[] = ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack']
      actions.forEach(action => {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // Some actions may not be supported
        }
      })
      console.log('WebRTC: Cleared media session')
    } catch (err) {
      console.warn('WebRTC: Failed to clear media session', err)
    }
  }
}

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
  type?: string
  offer: string
  iceCandidate?: string
  callId: string
  quality: VideoQuality
  from: User
  meetingId?: string
  meetingLastCallTime?: number
  videoEnabled?: boolean
  audioEnabled?: boolean
}

export function useWebRTCCommon(callUser: any) {
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([])
  const { setConnectionStatus, currentUser } = useStore( (state: any) => ({
    setConnectionStatus: state.setConnectionStatus,
    currentUser: state.currentUser
  }))
  const { refetchMyMeetingsWithPeers } = useMeetings()

  const handleConnectionStateChange = (pc: RTCPeerConnection, peerConnection: React.MutableRefObject<RTCPeerConnection | null>) => {
    console.log('Connection state changed', {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      iceGatheringState: pc.iceGatheringState,
      signalingState: pc.signalingState
    })

    if (pc.connectionState === 'connected') {
      console.log('Connection established successfully')
      setConnectionStatus(ConnectionStatus.CONNECTED)
    } else if (pc.connectionState === 'failed') {
      console.error('Connection failed', {
        iceConnectionState: pc.iceConnectionState
      })
      pc.close()
      peerConnection.current = null
      setConnectionStatus(ConnectionStatus.FAILED)
    }
  }

  const applyLocalQuality = async (peerConnection: RTCPeerConnection, quality: VideoQuality) => {
    try {
      const transceiver = peerConnection.getTransceivers().find(t => t.receiver.track?.kind === 'video')
      if (transceiver && transceiver.sender) {
        const sender = transceiver.sender
        const videoTrack = sender.track
        const config = QUALITY_CONFIGS[quality]

        console.log('Applying quality settings', {
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

          console.log('Track constraints applied', {
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

            console.log('Sender parameters updated', {
              encodings: params.encodings[0]
            })
          }
        }
      } else {
        console.warn('No sender with video track found for quality update')
        console.log('WebRTC: No sender with video track found')
      }
    } catch (err) {
      console.error('Failed to apply quality settings', { error: err })
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

    clientLogger.info('WebRTC', 'addLocalStream start', {
      isInitiator,
      localVideoEnabled,
      localAudioEnabled,
      trackCount: stream.getTracks().length,
      tracks: trackDetails,
      streamId: stream.id,
      existingTransceivers: pc.getTransceivers().map(t => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        senderTrackKind: t.sender.track?.kind,
        receiverTrackKind: t.receiver.track?.kind
      })),
      existingSenders: pc.getSenders().map(s => ({
        trackKind: s.track?.kind,
        trackId: s.track?.id
      }))
    })

    if (!pc.getTransceivers().length) {
      if (isInitiator) {
        clientLogger.info('WebRTC', 'addLocalStream adding transceivers as initiator', {
          localAudioEnabled,
          localVideoEnabled
        })
        // Initiator pre-creates transceivers
        if (localAudioEnabled) {
          pc.addTransceiver('audio', { direction: 'sendrecv', streams: [stream] })
        } else {
          pc.addTransceiver('audio', { direction: 'recvonly' })
        }
        // Video transceiver always sendrecv so we can bind later without renegotiation
        pc.addTransceiver('video', { direction: 'sendrecv', streams: [stream] })
      }
    } else if (!isInitiator) {
      clientLogger.info('WebRTC', 'addLocalStream (callee) existing transceivers before attach', {
        count: pc.getTransceivers().length,
        transceivers: pc.getTransceivers().map(t => ({
          mid: t.mid,
          direction: t.direction,
          currentDirection: t.currentDirection,
          senderTrackKind: t.sender.track?.kind,
          receiverTrackKind: t.receiver.track?.kind
        }))
      })
    }

    for (const track of stream.getTracks()) {
      const existingSender = pc.getSenders().find(s => s.track?.kind === track.kind)

      if (existingSender) {
        clientLogger.info('WebRTC', 'addLocalStream replacing existing sender track', {
          kind: track.kind,
          trackId: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
          oldTrackId: existingSender.track?.id
        })

        if (track.kind === 'video' && !localVideoEnabled) {
          track.enabled = false
          track.stop()
          console.log('Stopped disabled video track')
        } else if (track.kind === 'audio' && !localAudioEnabled) {
          track.enabled = false
          track.stop()
          console.log('Stopped disabled audio track')
        } else {
          existingSender.replaceTrack(track)
        }
      } else if ((track.kind === 'audio' && localAudioEnabled) || (track.kind === 'video' && localVideoEnabled)) {
        clientLogger.info('WebRTC', 'addLocalStream adding new track', {
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
    const before = pc.getTransceivers().map(t => ({
      mid: t.mid,
      senderKind: t.sender.track?.kind,
      receiverKind: t.receiver.track?.kind,
      direction: t.direction,
      currentDirection: t.currentDirection
    }))

    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.sender.track?.kind || transceiver.mid
      if (kind === 'video' || kind === '1') {
        transceiver.direction = 'sendrecv'
      } else if (kind === 'audio' || kind === '0') {
        transceiver.direction = localAudioEnabled ? 'sendrecv' : 'recvonly'
      }
    }

    const after = pc.getTransceivers().map(t => ({
      mid: t.mid,
      senderKind: t.sender.track?.kind,
      receiverKind: t.receiver.track?.kind,
      direction: t.direction,
      currentDirection: t.currentDirection
    }))

    clientLogger.info('WebRTC', 'configureTransceivers applied', {
      localVideoEnabled,
      localAudioEnabled,
      before,
      after
    })
  }

const handleTrack = (
  event: RTCTrackEvent,
  peerConnection: RTCPeerConnection,
  remoteVideoRef: React.RefObject<HTMLVideoElement>,
  remoteStreamRef: React.MutableRefObject<MediaStream | null>,
  onRemoteStreamUpdated?: () => void
) => {
    if (!peerConnection) {
      console.warn('handleTrack called but no peerConnection')
      return
    }

    const trackMeta = {
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
    }
    console.log('Track event received', trackMeta)
    clientLogger.info('WebRTC', 'Track event received', trackMeta)

    if (!event.streams[0]?.id.includes(currentUser?._id || '')) {
      // Some browsers may fire track events with no streams (esp. after renegotiation).
      const remoteStream = event.streams[0] ?? new MediaStream([event.track])
      if (remoteStream) {
        const remoteMeta = {
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
        }
        console.log('Remote stream received', remoteMeta)
        clientLogger.info('WebRTC', 'Remote stream received', remoteMeta)

        const previousStreamId = remoteStreamRef.current?.id
        // Always store the latest stream so UI can bind even if a new stream replaces the old one
        remoteStreamRef.current = remoteStream

        if (previousStreamId && previousStreamId !== remoteStream.id) {
          clientLogger.info('WebRTC', 'Remote stream replaced', {
            previousStreamId,
            newStreamId: remoteStream.id
          })
        }

        // Monitor remote track events
        remoteStream.getTracks().forEach(track => {
          track.addEventListener('ended', () => {
            console.warn('Remote track ended', {
              kind: track.kind,
              id: track.id,
              label: track.label
            })
          })

          track.addEventListener('mute', () => {
            console.log('Remote track muted', {
              kind: track.kind,
              id: track.id
            })
          })

          track.addEventListener('unmute', () => {
            console.log('Remote track unmuted', {
              kind: track.kind,
              id: track.id
            })
          })
        })

        // Attach to video element if it exists
        if (remoteVideoRef?.current) {
          remoteVideoRef.current.srcObject = remoteStream
          console.log('Remote stream attached to video element')
          clientLogger.info('WebRTC', 'Remote stream attached to video element', { streamId: remoteStream.id })
        }

        // Notify listeners (e.g., UI) that a remote stream was updated/arrived
        onRemoteStreamUpdated?.()

        // Apply saved remote quality preference if it exists
        if (event.track.kind === 'video') {
          const qualityRemoteWantsFromUs = syncStore().qualityRemoteWantsFromUs
          console.log('Applying quality from remote preference', {
            quality: qualityRemoteWantsFromUs
          })
          applyLocalQuality(peerConnection, qualityRemoteWantsFromUs).catch(err =>
            console.error('Failed to apply initial remote quality settings:', err)
          )
        }
      }
    } else {
      console.log('Ignoring own stream in track event')
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
      console.log('ICE gathering state changed', {
        iceGatheringState: pc.iceGatheringState
      })
    })

    // Monitor ICE connection state
    pc.addEventListener('iceconnectionstatechange', () => {
      console.log('ICE connection state changed', {
        iceConnectionState: pc.iceConnectionState
      })
    })

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const parsed = parseCandidate(event.candidate)
        console.log('ICE candidate generated', {
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
          console.log('ICE candidate sent to peer')
        } catch (err) {
          console.error('Failed to send ICE candidate', { error: err })
          console.error('WebRTC: Failed to send ICE candidate:', err)
        }
      } else {
        console.log('ICE gathering complete (null candidate)')
      }
    }
  }

  const handleIceCandidate = async (pc: RTCPeerConnection | null, candidate: RTCIceCandidateInit) => {
    const parsed = parseCandidate(candidate)
    console.log('Received ICE candidate from peer', {
      candidate: parsed,
      hasRemoteDescription: !!pc?.remoteDescription
    })

    try {
      if (pc?.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(candidate)
        console.log('ICE candidate added to peer connection')
      } else {
        pendingIceCandidates.current.push(candidate)
        console.log('ICE candidate buffered (no remote description yet)', {
          pendingCount: pendingIceCandidates.current.length
        })
      }
    } catch (err) {
      console.error('Failed to handle ICE candidate', { error: err })
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
    clientLogger.info('WebRTC', 'sendWantedMediaStateImpl toggled tracks', {
      targetUserId,
      callId,
      localVideoEnabled,
      localAudioEnabled,
      senderSummary: senders.map(s => ({
        trackKind: s.track?.kind,
        trackId: s.track?.id,
        enabled: s.track?.enabled,
        readyState: s.track?.readyState
      }))
    })
    
    // Update transceivers
    configureTransceivers(pc, localVideoEnabled, localAudioEnabled)

    clientLogger.info('WebRTC', 'sendWantedMediaStateImpl post-configure', {
      targetUserId,
      callId,
      transceivers: pc.getTransceivers().map(t => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        senderTrackKind: t.sender.track?.kind,
        senderTrackId: t.sender.track?.id,
        receiverTrackKind: t.receiver.track?.kind,
        receiverTrackId: t.receiver.track?.id
      }))
    })

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
    const baseMeta = {
      timestamp,
      hasCurrentStream: !!currentStream,
      localVideoEnabled,
      localAudioEnabled,
      currentStreamId: currentStream?.id
    }
    console.log('ensureMediaStream called', baseMeta)
    clientLogger.info('WebRTC', 'ensureMediaStream called', baseMeta)

    if (currentStream) {
      const tracks = currentStream.getTracks()
      const hasEndedTracks = tracks.some(track => track.readyState === 'ended')

      // Check if existing stream matches current enabled state
      const hasVideoTrack = tracks.some(track => track.kind === 'video')
      const hasAudioTrack = tracks.some(track => track.kind === 'audio')
      const streamMatchesState =
        (localVideoEnabled === hasVideoTrack) &&
        (localAudioEnabled === hasAudioTrack)

      const existingMeta = {
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
      }

      console.log('Existing stream analysis', existingMeta)
      clientLogger.info('WebRTC', 'Existing stream analysis', existingMeta)

      if (hasEndedTracks) {
        console.log('LocalStream has ended tracks, creating new stream')
        console.log('WebRTC: LocalStream has ended tracks, creating new stream')
        clientLogger.warn('WebRTC', 'LocalStream has ended tracks, recreating', existingMeta)
        // Stop old tracks
        tracks.forEach(track => track.stop())
      } else if (!streamMatchesState) {
        const mismatchMeta = {
          expectedVideo: localVideoEnabled,
          expectedAudio: localAudioEnabled,
          actualVideo: hasVideoTrack,
          actualAudio: hasAudioTrack
        }
        console.log('LocalStream tracks do not match enabled state, creating new stream', mismatchMeta)
        console.log('WebRTC: LocalStream tracks do not match enabled state, creating new stream')
        clientLogger.info('WebRTC', 'Recreating stream due to track mismatch', { ...existingMeta, ...mismatchMeta })
        // Stop old tracks since we need a different configuration
        tracks.forEach(track => track.stop())
      } else {
        console.log('Using existing localStream (valid)')
        console.log('WebRTC: Using existing localStream')
        clientLogger.info('WebRTC', 'Using existing localStream (valid)', existingMeta)
        return currentStream
      }
    } else {
      console.log('No localStream exists, creating new stream')
      console.log('WebRTC: No localStream exists, creating new stream')
      clientLogger.info('WebRTC', 'No localStream exists, creating new stream', { timestamp, localVideoEnabled, localAudioEnabled })
    }

    // Create new stream - only request tracks that are enabled
    // If both audio and video are disabled, create an empty MediaStream
    if (!localVideoEnabled && !localAudioEnabled) {
      console.log('Both audio and video disabled, creating empty stream')
      console.log('WebRTC: Both audio and video disabled, creating empty stream')
      clientLogger.info('WebRTC', 'Creating empty stream (both disabled)', { timestamp })
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

    const gumMeta = {
      timestamp,
      constraints,
      selectedVideoDevice,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    }
    console.log('Requesting getUserMedia', gumMeta)
    clientLogger.info('WebRTC', 'Requesting getUserMedia', gumMeta)

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      const successMeta = {
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
      }
      console.log('getUserMedia success', successMeta)
      clientLogger.info('WebRTC', 'getUserMedia success', successMeta)

      // Monitor track ended events on new stream
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          console.warn('Local track ended', {
            kind: track.kind,
            id: track.id,
            label: track.label,
            streamId: stream.id
          })
        })

        track.addEventListener('mute', () => {
          console.log('Local track muted', {
            kind: track.kind,
            id: track.id
          })
        })

        track.addEventListener('unmute', () => {
          console.log('Local track unmuted', {
            kind: track.kind,
            id: track.id
          })
        })
      })

      setLocalStream(stream)
      return stream
    } catch (err) {
      const errorName = (err as Error)?.name
      const errorMessage = (err as Error)?.message
      const meta = {
        timestamp,
        timeTaken: Date.now() - timestamp,
        error: err,
        errorName,
        errorMessage,
        constraints
      }
      if (errorName === 'NotAllowedError') {
        console.info('getUserMedia blocked by user/UA (NotAllowedError)', meta)
        clientLogger.warn('WebRTC', 'getUserMedia blocked (NotAllowedError)', meta)
      } else {
        console.error('getUserMedia failed', meta)
        clientLogger.error('WebRTC', 'getUserMedia failed', meta)
      }
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
