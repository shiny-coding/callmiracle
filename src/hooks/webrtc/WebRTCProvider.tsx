'use client'
import { useState, createContext, useContext, ReactNode, useRef, useEffect } from 'react'
import { useMutation, useLazyQuery, gql } from '@apollo/client'
import { useStore, syncStore } from '@/store/useStore'
import { useWebRTCCaller } from './useWebRTCCaller'
import { useWebRTCCallee } from './useWebRTCCallee'
import { CALL_USER, ConnectionStatus, type IncomingRequest } from './useWebRTCCommon'
import { type VideoQuality } from '@/components/VideoQualitySelector'
import { useWebRTCCommon } from './useWebRTCCommon'
import { User } from '@/generated/graphql'
import { useSubscriptions } from '@/contexts/SubscriptionsContext'
import clientLogger from '@/utils/clientLogger'

const GET_PENDING_CALL = gql`
  query GetPendingCall($userId: ID!) {
    getPendingCall(userId: $userId) {
      callId
      from {
        _id
        name
        sex
        languages
        updatedAt
      }
      meetingId
      meetingLastCallTime
      offer
      videoEnabled
      audioEnabled
      quality
    }
  }
`

interface WebRTCContextType {
  doCall: (user: User, meetingId: string | null, meetingLastCallTime: number | null) => Promise<void>
  connectionStatus: ConnectionStatus
  incomingRequest: IncomingRequest | null
  handleAcceptCall: () => void
  handleRejectCall: () => void
  hangup: () => Promise<void>
  remoteVideoEnabled: boolean
  remoteAudioEnabled: boolean
  localStream: MediaStream | undefined
  setLocalStream: (stream: MediaStream | undefined) => void
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  sendWantedMediaState: () => Promise<void>
  callUser: any
  callee: ReturnType<typeof useWebRTCCallee>
  caller: ReturnType<typeof useWebRTCCaller>
  remoteStreamVersion: number
}

interface WebRTCProviderProps {
  children: ReactNode
}

const WebRTCContext = createContext<WebRTCContextType | null>(null)

export function useWebRTCContext() {
  const context = useContext(WebRTCContext)
  if (!context) {
    throw new Error('useWebRTCContext must be used within a WebRTCProvider')
  }
  return context
}

export function WebRTCProvider({
  children,
}: WebRTCProviderProps) {
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false)
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream>()
  const [remoteStreamVersion, setRemoteStreamVersion] = useState(0)
  const localStreamRef = useRef<MediaStream | undefined>(undefined)
  const remoteVideoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>
  const [callUser] = useMutation(CALL_USER)
  const [getPendingCall] = useLazyQuery(GET_PENDING_CALL, { fetchPolicy: 'network-only' })
  const {applyLocalQuality, sendWantedMediaStateImpl, ensureMediaStream} = useWebRTCCommon(callUser)
  const { subscribeToCallEvents } = useSubscriptions()
  const pendingCallCheckedRef = useRef(false)
  const renegotiationInFlightRef = useRef(false)

  // Keep localStreamRef in sync with localStream state
  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  const {
    currentUser,
    callId,
    connectionStatus,
    targetUser,
    role,
    setConnectionStatus,
    setTargetUser,
    setRole,
    clearCallState,
    setCallId,
    meetingId,
    meetingLastCallTime,
    setCallEndedInfo,
  } = useStore((state) => ({
    currentUser: state.currentUser,
    callId: state.callId,
    connectionStatus: state.connectionStatus,
    targetUser: state.targetUser,
    role: state.role,
    setConnectionStatus: state.setConnectionStatus,
    setTargetUser: state.setTargetUser,
    setRole: state.setRole,
    clearCallState: state.clearCallState,
    setCallId: state.setCallId,
    meetingId: state.meetingId,
    meetingLastCallTime: state.meetingLastCallTime,
    setCallEndedInfo: state.setCallEndedInfo,
  }))

  const handleRemoteStreamUpdated = () => {
    const nextVersion = remoteStreamVersion + 1
    const currentStreamId =
      caller.remoteStreamRef?.current?.id ||
      callee.remoteStreamRef?.current?.id ||
      null

    clientLogger.info('[WebRTC] Remote stream updated', {
      nextVersion,
      callerActive: caller.active,
      calleeActive: callee.active,
      callerStreamId: caller.remoteStreamRef?.current?.id,
      calleeStreamId: callee.remoteStreamRef?.current?.id,
      chosenStreamId: currentStreamId
    })

    setRemoteStreamVersion((v) => v + 1)
  }

  const childProps = {
    localStream,
    remoteVideoRef,
    callUser,
    setLocalStream,
    onRemoteStreamUpdated: handleRemoteStreamUpdated
  }

  const caller = useWebRTCCaller(childProps)
  const callee = useWebRTCCallee(childProps)
  const attachTracksToPeer = async (pc: RTCPeerConnection, stream: MediaStream) => {
    const tracks = stream.getTracks()
    const senders = pc.getSenders()
    const existingSenders = senders.map(s => ({
      trackKind: s.track?.kind,
      trackId: s.track?.id,
      readyState: s.track?.readyState
    }))

    clientLogger.info('[WebRTC] attachTracksToPeer start', {
      streamId: stream.id,
      trackCount: tracks.length,
      tracks: tracks.map(t => ({ kind: t.kind, id: t.id, readyState: t.readyState, enabled: t.enabled })),
      senders: existingSenders
    })

    const attachPromises: Promise<void>[] = []
    let attachedTrack = false

    tracks.forEach(track => {
      clientLogger.info('[WebRTC] attachTracksToPeer evaluating track', {
        kind: track.kind,
        trackId: track.id,
        readyState: track.readyState,
        enabled: track.enabled,
        muted: track.muted
      })

      // Try sender with matching kind
      const sender = senders.find(s => s.track?.kind === track.kind)
      if (sender) {
        attachPromises.push(
          sender.replaceTrack(track).then(() => {
            clientLogger.info('[WebRTC] attachTracksToPeer replaced existing sender track', {
              kind: track.kind,
              trackId: track.id
            })
            attachedTrack = true
          }).catch(err => {
            clientLogger.error('[WebRTC] attachTracksToPeer failed to replace sender track', {
              kind: track.kind,
              trackId: track.id,
              error: String(err)
            })
          })
        )
      } else {
        clientLogger.warn('[WebRTC] attachTracksToPeer no matching sender, trying transceiver', {
          kind: track.kind,
          trackId: track.id
        })
        // Try transceiver with matching kind
        const transceiver = pc.getTransceivers().find(t => {
          const senderKind = t.sender.track?.kind
          const receiverKind = t.receiver.track?.kind
          const midKind = t.mid === '0' ? 'audio' : t.mid === '1' ? 'video' : undefined
          return senderKind === track.kind || receiverKind === track.kind || midKind === track.kind
        })

        if (transceiver) {
          attachPromises.push(
            transceiver.sender.replaceTrack(track).then(() => {
              clientLogger.info('[WebRTC] attachTracksToPeer attached via transceiver', {
                kind: track.kind,
                trackId: track.id,
            transceiverMid: transceiver.mid
          })
          attachedTrack = true
        }).catch(err => {
          clientLogger.error('[WebRTC] attachTracksToPeer failed via transceiver', {
            kind: track.kind,
            trackId: track.id,
            error: String(err)
              })
            })
          )
        }

        if (!sender && !transceiver) {
          clientLogger.warn('[WebRTC] attachTracksToPeer no sender/transceiver found, adding track', {
            kind: track.kind,
            trackId: track.id
          })
          try {
            pc.addTrack(track, stream)
            clientLogger.info('[WebRTC] attachTracksToPeer added new sender', {
              kind: track.kind,
              trackId: track.id
            })
            attachedTrack = true
          } catch (err) {
            clientLogger.error('[WebRTC] attachTracksToPeer failed to addTrack', {
              kind: track.kind,
              trackId: track.id,
              error: String(err)
            })
          }
        }
      }
    })

    if (attachPromises.length) {
      await Promise.allSettled(attachPromises)
    }

    clientLogger.info('[WebRTC] attachTracksToPeer summary', {
      streamId: stream.id,
      attachedTrack,
      trackKinds: tracks.map(t => t.kind),
      senderSummary: pc.getSenders().map(s => ({
        trackKind: s.track?.kind,
        trackId: s.track?.id,
        readyState: s.track?.readyState,
        enabled: s.track?.enabled
      })),
      transceiverSummary: pc.getTransceivers().map(t => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection,
        senderTrackKind: t.sender.track?.kind,
        senderTrackId: t.sender.track?.id,
        receiverTrackKind: t.receiver.track?.kind,
        receiverTrackId: t.receiver.track?.id
      }))
    })
  }

  const sendRenegotiationOffer = async (pc: RTCPeerConnection, targetUserId: string, callId?: string | null) => {
    if (!pc) return
    if (renegotiationInFlightRef.current) {
      clientLogger.info('[WebRTC] Renegotiation skipped (already in flight)', {
        callId,
        signalingState: pc.signalingState
      })
      return
    }
    if (pc.signalingState !== 'stable') {
      clientLogger.warn('[WebRTC] Renegotiation skipped (signaling not stable)', {
        callId,
        signalingState: pc.signalingState
      })
      return
    }

    renegotiationInFlightRef.current = true
    try {
      if (pc.signalingState !== 'stable') {
        clientLogger.warn('[WebRTC] Renegotiation skipped (not stable)', {
          callId,
          signalingState: pc.signalingState
        })
        return
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      clientLogger.info('[WebRTC] Sending renegotiation offer', {
        callId,
        targetUserId,
        sdpType: offer.type
      })

      await callUser({
        variables: {
          input: {
            type: 'renegotiate-offer',
            targetUserId,
            initiatorUserId: currentUser?._id,
            offer: JSON.stringify(offer),
            callId
          }
        }
      })
    } catch (err) {
      clientLogger.error('[WebRTC] Failed to send renegotiation offer', {
        callId,
        error: String(err)
      })
    } finally {
      renegotiationInFlightRef.current = false
    }
  }

  // Check for pending calls when app opens (e.g., from notification click)
  useEffect(() => {
    if (!currentUser?._id || pendingCallCheckedRef.current || callId) return

    pendingCallCheckedRef.current = true

    const checkPendingCall = async () => {
      try {
        console.log('Checking for pending call', { userId: currentUser._id })
        const { data } = await getPendingCall({ variables: { userId: currentUser._id } })

        if (data?.getPendingCall) {
          const pendingCall = data.getPendingCall
          console.log('Found pending call', {
            callId: pendingCall.callId,
            from: pendingCall.from.name,
            meetingId: pendingCall.meetingId
          })

          // Restore the incoming call state
          setCallId(pendingCall.callId)
          setTargetUser(pendingCall.from)
          setRole('callee')
          setConnectionStatus(ConnectionStatus.RECEIVING_CALL)
          setRemoteVideoEnabled(pendingCall.videoEnabled)
          setRemoteAudioEnabled(pendingCall.audioEnabled)

          // Set the incoming request with offer data for CalleeDialog
          callee.setIncomingRequest({
            type: 'offer',
            from: pendingCall.from,
            callId: pendingCall.callId,
            meetingId: pendingCall.meetingId,
            meetingLastCallTime: pendingCall.meetingLastCallTime,
            offer: pendingCall.offer,
            videoEnabled: pendingCall.videoEnabled,
            audioEnabled: pendingCall.audioEnabled,
            quality: pendingCall.quality
          } as IncomingRequest)
        }
      } catch (err) {
        console.error('Failed to check pending call', { error: err })
      }
    }

    checkPendingCall()
  }, [currentUser?._id, callId])

  useEffect(() => {
    const unsubscribe = subscribeToCallEvents(async (callEvent) => {
      if (callEvent.type !== 'initiate' && callEvent.callId !== callId) {
        console.log('WebRTC: Ignoring connection request - mismatched IDs: ', { callEvent, callId })
        return
      }

      if (callEvent.type === 'initiate') {
        // Clear any lingering call-ended dialog when a new call arrives
        setCallEndedInfo(null)
        if (callId) {
          // Already in a call, send busy response
          console.log('WebRTC: Already in call, sending busy signal')
          setTimeout(async () => {
            await callUser({
              variables: {
                input: {
                  type: 'busy',
                  targetUserId: callEvent.from._id,
                  initiatorUserId: currentUser?._id,
                  callId: callEvent.callId
                }
              }
            })
          }, 1000) // we're not immediately sending the busy, so that the callee has time to receive the callId (sic!)
        } else {
          // Set up for receiving call
          console.log('WebRTC: Received initiate request')
          setCallId(callEvent.callId ?? null)
          setTargetUser(callEvent.from)
          setRole('callee')
          setConnectionStatus(ConnectionStatus.RECEIVING_CALL)
          callee.active = true
        }
      } else if (callEvent.type === 'finished') {
        // Read lastConnectedTime directly from store to avoid stale closure
        const currentLastConnectedTime = syncStore().lastConnectedTime

        console.log('WebRTC: Received finished request', {
          from: callEvent.from?.name,
          fromId: callEvent.from?._id,
          lastConnectedTime: currentLastConnectedTime,
          now: Date.now()
        })

        // Calculate call duration if we were connected
        const durationS = currentLastConnectedTime
          ? Math.floor((Date.now() - currentLastConnectedTime) / 1000)
          : 0

        console.log('WebRTC: Call ended info calculation', {
          durationS,
          hasFrom: !!callEvent.from,
          willShowDialog: !!(callEvent.from && durationS > 0)
        })

        // Show call ended dialog with partner info and duration
        if (callEvent.from && durationS > 0) {
          console.log('WebRTC: Setting call ended info', {
            user: callEvent.from.name,
            durationS,
            meetingId: callEvent.meetingId
          })
          setCallEndedInfo({
            user: callEvent.from,
            durationS,
            meetingId: callEvent.meetingId || undefined
          })
        }

        // Handle finished status
        if (caller.active) {
          await caller.cleanup()
        } else if (callee.active) {
          await callee.cleanup()
        }

        // Ensure peer connections are closed (using refs to avoid stale closure)
        if (caller.peerConnection.current) {
          console.log('WebRTC: Closing caller peer connection on finished')
          caller.peerConnection.current.close()
          caller.peerConnection.current = null
        }
        if (callee.peerConnection.current) {
          console.log('WebRTC: Closing callee peer connection on finished')
          callee.peerConnection.current.close()
          callee.peerConnection.current = null
        }

        // Ensure local stream tracks are stopped (using ref to avoid stale closure)
        const currentStream = localStreamRef.current
        if (currentStream) {
          console.log('WebRTC: Stopping local stream tracks on call finished', {
            streamId: currentStream.id,
            trackCount: currentStream.getTracks().length
          })
          currentStream.getTracks().forEach(track => {
            console.log('WebRTC: Stopping track', { kind: track.kind, id: track.id })
            track.stop()
          })
          setLocalStream(undefined)
        }

        setConnectionStatus(ConnectionStatus.FINISHED)
        setRemoteVideoEnabled(false)
        setRemoteAudioEnabled(false)
        clearCallState()
      }
      // Handle answer for initiator
      else if (callEvent.type === 'answer') {
        if (!caller.peerConnection.current) {
          console.log('WebRTC: Connection closed before answer')
          await callUser({
            variables: {
              input: {
                type: 'expired',
                targetUserId: callEvent.from._id,
                initiatorUserId: currentUser?._id,
                callId
              }
            }
          })
        } else {
          console.log('WebRTC: Processing answer')
          const answer = JSON.parse(callEvent.answer as string)
          setRemoteVideoEnabled(callEvent.videoEnabled as boolean)
          setRemoteAudioEnabled(callEvent.audioEnabled as boolean)
          await caller.handleAnswer(caller.peerConnection.current, callEvent.quality as VideoQuality, answer)
        }
      }
      // Handle offer
      else if (callEvent.type === 'offer') {
        setRemoteVideoEnabled(callEvent.videoEnabled as boolean)
        setRemoteAudioEnabled(callEvent.audioEnabled as boolean)
        callee.setIncomingRequest(callEvent as IncomingRequest)
      }
      // Handle ICE candidates
      else if (callEvent.type === 'ice-candidate') {
        const candidate = JSON.parse(callEvent.iceCandidate as string)
        if (caller.active) {
          await caller.handleIceCandidate(caller.peerConnection.current!, candidate)
        } else { // we're not checking calee.active because we can receive candidates before callee becomes active after accepting the call
          await callee.handleIceCandidate(callee.peerConnection.current!, candidate)
        }
      }
      // Handle renegotiation offer
      else if (callEvent.type === 'renegotiate-offer') {
        const offer = JSON.parse(callEvent.offer as string)
        const pc =
          caller.peerConnection.current ||
          callee.peerConnection.current ||
          (caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null)
        if (!pc) {
          clientLogger.warn('[WebRTC] Received renegotiation offer with no active peer connection')
          return
        }
        try {
          clientLogger.info('[WebRTC] Processing renegotiation offer', {
            callId,
            callerActive: caller.active,
            calleeActive: callee.active,
            signalingState: pc.signalingState
          })
          await pc.setRemoteDescription(new RTCSessionDescription(offer))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)

          clientLogger.info('[WebRTC] Renegotiation answer created', {
            callId,
            signalingState: pc.signalingState
          })

          await callUser({
            variables: {
              input: {
                type: 'renegotiate-answer',
                targetUserId: callEvent.from._id,
                initiatorUserId: currentUser?._id,
                answer: JSON.stringify(answer),
                callId
              }
            }
          })
        } catch (err) {
          clientLogger.error('[WebRTC] Failed to process renegotiation offer', {
            error: String(err),
            callId
          })
        }
      }
      // Handle renegotiation answer
      else if (callEvent.type === 'renegotiate-answer') {
        const answer = JSON.parse(callEvent.answer as string)
        const pc =
          caller.peerConnection.current ||
          callee.peerConnection.current ||
          (caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null)
        if (!pc) {
          clientLogger.warn('[WebRTC] Received renegotiation answer with no active peer connection')
          return
        }
        try {
          clientLogger.info('[WebRTC] Processing renegotiation answer', {
            callId,
            signalingState: pc.signalingState
          })
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer))
          } else {
            clientLogger.warn('[WebRTC] Skipping renegotiation answer (unexpected signaling state)', {
              callId,
              signalingState: pc.signalingState
            })
          }
        } catch (err) {
          clientLogger.error('[WebRTC] Failed to process renegotiation answer', {
            error: String(err),
            callId
          })
        }
      }
      // Handle track changes
      else if (callEvent.type === 'updateMediaState') {
        console.log('WebRTC: updateMediaState')
        setRemoteVideoEnabled(callEvent.videoEnabled ?? remoteVideoEnabled)
        setRemoteAudioEnabled(callEvent.audioEnabled ?? remoteAudioEnabled)
        const quality = callEvent.quality as VideoQuality
        const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null

        const receiverSummary = activePeerConnection
          ? activePeerConnection.getReceivers().map(r => ({
              trackKind: r.track?.kind,
              trackId: r.track?.id,
              trackReadyState: r.track?.readyState,
              trackEnabled: r.track?.enabled
            }))
          : []

        const transceiverSummary = activePeerConnection
          ? activePeerConnection.getTransceivers().map(t => ({
              mid: t.mid,
              direction: t.direction,
              currentDirection: t.currentDirection,
              senderTrackKind: t.sender.track?.kind,
              senderTrackId: t.sender.track?.id,
              receiverTrackKind: t.receiver.track?.kind,
              receiverTrackId: t.receiver.track?.id
            }))
          : []

        clientLogger.info('[WebRTC] updateMediaState received', {
          callId,
          callerActive: caller.active,
          calleeActive: callee.active,
          remoteVideoEnabled: callEvent.videoEnabled,
          remoteAudioEnabled: callEvent.audioEnabled,
          quality,
          hasActivePeerConnection: !!activePeerConnection,
          pcState: activePeerConnection
            ? {
                connectionState: activePeerConnection.connectionState,
                iceConnectionState: activePeerConnection.iceConnectionState,
                signalingState: activePeerConnection.signalingState
              }
            : null,
          remoteStreamIds: {
            caller: caller.remoteStreamRef?.current?.id ?? null,
            callee: callee.remoteStreamRef?.current?.id ?? null
          },
          receiverSummary,
          transceiverSummary
        })

        if (activePeerConnection) {
          applyLocalQuality(activePeerConnection, quality).catch(err => 
            console.error('WebRTC: Failed to apply quality settings:', err)
          )
        } else {
          clientLogger.warn('[WebRTC] updateMediaState with no active peer connection', {
            callerActive: caller.active,
            calleeActive: callee.active
          })
        }
      }
      else if (callEvent.type === 'expired') { // Handle expired connection
        console.log('WebRTC: Received expired signal, cleaning up')
        callee.cleanup()

        // Ensure peer connections are closed (using refs to avoid stale closure)
        if (caller.peerConnection.current) {
          console.log('WebRTC: Closing caller peer connection on expired')
          caller.peerConnection.current.close()
          caller.peerConnection.current = null
        }
        if (callee.peerConnection.current) {
          console.log('WebRTC: Closing callee peer connection on expired')
          callee.peerConnection.current.close()
          callee.peerConnection.current = null
        }

        // Ensure local stream tracks are stopped (using ref to avoid stale closure)
        const currentStream = localStreamRef.current
        if (currentStream) {
          console.log('WebRTC: Stopping local stream tracks on expired', {
            streamId: currentStream.id,
            trackCount: currentStream.getTracks().length
          })
          currentStream.getTracks().forEach(track => {
            console.log('WebRTC: Stopping track', { kind: track.kind, id: track.id })
            track.stop()
          })
          setLocalStream(undefined)
        }

        setConnectionStatus(ConnectionStatus.TIMEOUT)
        setRemoteVideoEnabled(false)
        setRemoteAudioEnabled(false)
        clearCallState()
      }
      else if (callEvent.type === 'busy') { // Handle busy signal
        console.log('WebRTC: Received busy signal')
        if (caller.active) {
          await caller.cleanup()
        }

        // Ensure peer connections are closed (using refs to avoid stale closure)
        if (caller.peerConnection.current) {
          console.log('WebRTC: Closing caller peer connection on busy')
          caller.peerConnection.current.close()
          caller.peerConnection.current = null
        }
        if (callee.peerConnection.current) {
          console.log('WebRTC: Closing callee peer connection on busy')
          callee.peerConnection.current.close()
          callee.peerConnection.current = null
        }

        // Ensure local stream tracks are stopped (using ref to avoid stale closure)
        const currentStream = localStreamRef.current
        if (currentStream) {
          console.log('WebRTC: Stopping local stream tracks on busy', {
            streamId: currentStream.id,
            trackCount: currentStream.getTracks().length
          })
          currentStream.getTracks().forEach(track => {
            console.log('WebRTC: Stopping track', { kind: track.kind, id: track.id })
            track.stop()
          })
          setLocalStream(undefined)
        }

        setConnectionStatus(ConnectionStatus.BUSY)
        setRemoteVideoEnabled(false)
        setRemoteAudioEnabled(false)
        clearCallState()
      }
      // Handle unknown request type
      else {
        throw new Error(`WebRTC: Unknown call event type: ${callEvent.type}`)
      }
    })

    return unsubscribe
  }, [subscribeToCallEvents, callId])

  // Watch for stream changes and update peer connections
  useEffect(() => {
    if (!localStream) {
      clientLogger.info('[WebRTC] Track replacement skipped (no localStream)')
      return
    }

    // Get the active peer connection from either caller or callee
    const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null
    if (!activePeerConnection) {
      clientLogger.info('[WebRTC] Track replacement skipped (no active peer connection)', {
        callerActive: caller.active,
        calleeActive: callee.active
      })
      return
    }

    const role = caller.active ? 'caller' : 'callee'
    const streamTracks = localStream.getTracks()

    clientLogger.info('[WebRTC] Track replacement start', {
      role,
      streamId: localStream.id,
      trackCount: streamTracks.length,
      tracks: streamTracks.map(t => ({
        kind: t.kind,
        id: t.id,
        label: t.label,
        readyState: t.readyState,
        enabled: t.enabled,
        muted: t.muted,
        settings: t.getSettings()
      })),
      connectionState: activePeerConnection.connectionState,
      iceConnectionState: activePeerConnection.iceConnectionState,
      signalingState: activePeerConnection.signalingState
    })

    // Update tracks in the active peer connection
    const senders = activePeerConnection.getSenders()
    clientLogger.info('[WebRTC] Current senders before replacement', {
      senderCount: senders.length,
      senders: senders.map(s => ({
        trackKind: s.track?.kind,
        trackId: s.track?.id,
        trackReadyState: s.track?.readyState,
        trackEnabled: s.track?.enabled
      }))
    })

    localStream.getTracks().forEach(track => {
      const sender = senders.find(s => s.track?.kind === track.kind)
      if (sender) {
        const oldTrackId = sender.track?.id
        const oldTrackReadyState = sender.track?.readyState

        clientLogger.info('[WebRTC] Replacing track on sender', {
          kind: track.kind,
          newTrackId: track.id,
          newTrackReadyState: track.readyState,
          newTrackEnabled: track.enabled,
          newTrackMuted: track.muted,
          oldTrackId,
          oldTrackReadyState,
          trackChanged: oldTrackId !== track.id
        })

        sender.replaceTrack(track).then(() => {
          clientLogger.info('[WebRTC] Track replaced on sender', {
            kind: track.kind,
            newTrackId: track.id
          })
        }).catch(err => {
          clientLogger.error('[WebRTC] Failed to replace track on sender', {
            kind: track.kind,
            trackId: track.id,
            error: String(err)
          })
        })
      } else {
        clientLogger.warn('[WebRTC] No sender found for track kind', {
          kind: track.kind,
          trackId: track.id
        })
        const transceiver = activePeerConnection.getTransceivers().find(t => {
          const senderKind = t.sender.track?.kind
          const receiverKind = t.receiver.track?.kind
          const midKind = t.mid === '0' ? 'audio' : t.mid === '1' ? 'video' : undefined
          return senderKind === track.kind || receiverKind === track.kind || midKind === track.kind
        })

        if (transceiver) {
          clientLogger.info('[WebRTC] Attaching track via transceiver.sender', {
            kind: track.kind,
            trackId: track.id,
            transceiverMid: transceiver.mid
          })
          transceiver.sender.replaceTrack(track).then(() => {
            clientLogger.info('[WebRTC] Track attached via transceiver.sender', {
              kind: track.kind,
              trackId: track.id,
              transceiverMid: transceiver.mid
            })
          }).catch(err => {
            clientLogger.error('[WebRTC] Failed to attach track via transceiver.sender', {
              kind: track.kind,
              trackId: track.id,
              error: String(err)
            })
          })
        } else {
          clientLogger.warn('[WebRTC] No transceiver found for track kind, adding track', {
            kind: track.kind,
            trackId: track.id
          })
          try {
            activePeerConnection.addTrack(track, localStream)
            clientLogger.info('[WebRTC] Track added to peer connection (new sender)', {
              kind: track.kind,
              trackId: track.id
            })
          } catch (err) {
            clientLogger.error('[WebRTC] Failed to add track to peer connection', {
              kind: track.kind,
              trackId: track.id,
              error: String(err)
            })
          }
        }
      }
    })
  }, [localStream, caller.active, caller.peerConnection, callee.active, callee.peerConnection])

  // Handle media state changes (video/audio/quality)
  const sendWantedMediaState = async () => {
    const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null
    if (!callId || !activePeerConnection || !targetUser || !(caller.active || callee.active)) {
      if (callId) {
        clientLogger.info('[WebRTC] sendWantedMediaState skipped', {
          hasCallId: !!callId,
          hasActivePeerConnection: !!activePeerConnection,
          hasTargetUser: !!targetUser,
          callerActive: caller.active,
          calleeActive: callee.active
        })
      }
      return
    }

    const { localVideoEnabled, localAudioEnabled, qualityWeWantFromRemote } = syncStore()

    const hasEndedTracks = localStreamRef.current?.getTracks().some(track => track.readyState === 'ended')
    const missingVideoTrack = localVideoEnabled && !(localStreamRef.current?.getVideoTracks().length)
    const missingAudioTrack = localAudioEnabled && !(localStreamRef.current?.getAudioTracks().length)

    clientLogger.info('[WebRTC] sendWantedMediaState start', {
      callId,
      callerActive: caller.active,
      calleeActive: callee.active,
      localVideoEnabled,
      localAudioEnabled,
      qualityWeWantFromRemote,
      hasEndedTracks,
      missingVideoTrack,
      missingAudioTrack,
      currentStreamId: localStreamRef.current?.id ?? null,
      currentTrackSummary: localStreamRef.current
        ? localStreamRef.current.getTracks().map(t => ({
            kind: t.kind,
            id: t.id,
            readyState: t.readyState,
            enabled: t.enabled,
            muted: t.muted
          }))
        : []
    })

    let streamToUse = localStreamRef.current

    if (!localStreamRef.current || hasEndedTracks || missingVideoTrack || missingAudioTrack) {
      try {
        streamToUse = await ensureMediaStream(localStreamRef.current, setLocalStream, localVideoEnabled, localAudioEnabled)
      } catch (err) {
        clientLogger.error('[WebRTC] Failed to refresh media stream before sending media state', { error: String(err) })
        return
      }
    }

    if (streamToUse) {
      // Keep ref in sync if ensureMediaStream returned a new stream
      localStreamRef.current = streamToUse
      await attachTracksToPeer(activePeerConnection, streamToUse)

      clientLogger.info('[WebRTC] sendWantedMediaState post-attach', {
        streamId: streamToUse.id,
        trackCount: streamToUse.getTracks().length,
        tracks: streamToUse.getTracks().map(t => ({
          kind: t.kind,
          id: t.id,
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted
        })),
        senderSummary: activePeerConnection.getSenders().map(s => ({
          trackKind: s.track?.kind,
          trackId: s.track?.id,
          readyState: s.track?.readyState,
          enabled: s.track?.enabled
        })),
        transceiverSummary: activePeerConnection.getTransceivers().map(t => ({
          mid: t.mid,
          direction: t.direction,
          currentDirection: t.currentDirection,
          senderTrackKind: t.sender.track?.kind,
          senderTrackId: t.sender.track?.id,
          receiverTrackKind: t.receiver.track?.kind,
          receiverTrackId: t.receiver.track?.id
        }))
      })
    }

    clientLogger.info('[WebRTC] sendWantedMediaState', {
      callId,
      targetUserId: targetUser._id,
      callerActive: caller.active,
      calleeActive: callee.active,
      localVideoEnabled,
      localAudioEnabled,
      qualityWeWantFromRemote,
      pcState: {
        connectionState: activePeerConnection.connectionState,
        iceConnectionState: activePeerConnection.iceConnectionState,
        signalingState: activePeerConnection.signalingState
      },
      senders: activePeerConnection.getSenders().map(s => ({
        trackKind: s.track?.kind,
        trackId: s.track?.id,
        trackReadyState: s.track?.readyState,
        trackEnabled: s.track?.enabled
      }))
    })

    sendWantedMediaStateImpl(
      activePeerConnection,
      localVideoEnabled,
      localAudioEnabled,
      targetUser._id,
      qualityWeWantFromRemote,
      callId
    )

    // Only the callee (the side that typically has recvonly video initially) initiates renegotiation.
    if (callee.active) {
      const transceivers = activePeerConnection.getTransceivers()
      const videoTx = transceivers.find(t => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video' || t.mid === '1')
      const audioTx = transceivers.find(t => t.sender.track?.kind === 'audio' || t.receiver.track?.kind === 'audio' || t.mid === '0')

      const needsRenegotiation =
        (localVideoEnabled && videoTx && videoTx.currentDirection !== 'sendrecv') ||
        (localAudioEnabled && audioTx && audioTx.currentDirection !== 'sendrecv')

      clientLogger.info('[WebRTC] Renegotiation check after media toggle', {
        callId,
        localVideoEnabled,
        localAudioEnabled,
        videoTx: videoTx ? { mid: videoTx.mid, direction: videoTx.direction, currentDirection: videoTx.currentDirection } : null,
        audioTx: audioTx ? { mid: audioTx.mid, direction: audioTx.direction, currentDirection: audioTx.currentDirection } : null,
        needsRenegotiation
      })

      if (needsRenegotiation && targetUser) {
        clientLogger.info('[WebRTC] Renegotiation required after media toggle (callee)', {
          callId,
          targetUserId: targetUser._id
        })
        await sendRenegotiationOffer(activePeerConnection, targetUser._id, callId)
      }
    }
  }

  const hangup = async () => {
    if (caller.active) {
      await caller.hangup()
    } else if (callee.active) {
      await callee.hangup()
    }

    // Ensure peer connections are closed (using refs to avoid stale closure)
    if (caller.peerConnection.current) {
      console.log('WebRTC: Closing caller peer connection on hangup')
      caller.peerConnection.current.close()
      caller.peerConnection.current = null
    }
    if (callee.peerConnection.current) {
      console.log('WebRTC: Closing callee peer connection on hangup')
      callee.peerConnection.current.close()
      callee.peerConnection.current = null
    }

    // Ensure local stream tracks are stopped (using ref to avoid stale closure)
    const currentStream = localStreamRef.current
    if (currentStream) {
      console.log('WebRTC: Stopping local stream tracks on hangup', {
        streamId: currentStream.id,
        trackCount: currentStream.getTracks().length
      })
      currentStream.getTracks().forEach(track => {
        console.log('WebRTC: Stopping track', { kind: track.kind, id: track.id })
        track.stop()
      })
      setLocalStream(undefined)
    }

    setConnectionStatus(ConnectionStatus.FINISHED)
    setRemoteVideoEnabled(false)
    setRemoteAudioEnabled(false)
    clearCallState()
  }

  useEffect(() => {
    const handleBeforeUnload = () => {
      caller.peerConnection?.current?.close()
      callee.peerConnection?.current?.close()
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Safeguard: when a remote stream arrives before the video element mounts, bind it once both exist
  useEffect(() => {
    const stream =
      caller.remoteStreamRef?.current ||
      callee.remoteStreamRef?.current ||
      null

    const videoEl = remoteVideoRef.current
    if (!stream || !videoEl) return

    clientLogger.info('[WebRTC] Binding remote stream in provider effect', {
      streamId: stream.id,
      remoteStreamVersion,
      hasVideoElement: !!videoEl
    })

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream
    }

    videoEl.play().then(() => {
      clientLogger.info('[WebRTC] Remote stream bound from provider effect', { streamId: stream.id })
    }).catch(err => {
      clientLogger.error('[WebRTC] Failed to play remote video from provider effect', { error: String(err), streamId: stream.id })
    })
  }, [remoteStreamVersion, remoteVideoRef])

  const value: WebRTCContextType = {
    doCall: caller.doCall,
    connectionStatus: connectionStatus || ConnectionStatus.DISCONNECTED,
    incomingRequest: callee.incomingRequest,
    handleAcceptCall: callee.handleAcceptCall,
    handleRejectCall: callee.handleRejectCall,
    hangup,
    remoteVideoEnabled,
    remoteAudioEnabled,
    localStream,
    setLocalStream,
    remoteVideoRef,
    sendWantedMediaState,
    callUser,
    callee,
    caller,
    remoteStreamVersion
  }

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  )
} 
