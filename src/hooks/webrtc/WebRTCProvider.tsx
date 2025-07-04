'use client'
import { useState, createContext, useContext, ReactNode, useRef, useEffect } from 'react'
import { useSubscription, useMutation } from '@apollo/client'
import { useStore, syncStore } from '@/store/useStore'
import { useWebRTCCaller } from './useWebRTCCaller'
import { useWebRTCCallee } from './useWebRTCCallee'
import { CALL_USER, type ConnectionStatus, type IncomingRequest } from './useWebRTCCommon'
import { type VideoQuality } from '@/components/VideoQualitySelector'
import { useWebRTCCommon } from './useWebRTCCommon'
import { User } from '@/generated/graphql'
import { useSubscriptions } from '@/contexts/SubscriptionsContext'

interface WebRTCContextType {
  doCall: (user: User, isReconnect: boolean, meetingId: string | null, meetingLastCallTime: number | null) => Promise<void>
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
  sendWantedMediaState: () => void
  callUser: any
  callee: ReturnType<typeof useWebRTCCallee>
  caller: ReturnType<typeof useWebRTCCaller>
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

function useInitializeLocalStream(setLocalStream: (stream: MediaStream | undefined) => void) {
  useEffect(() => {
    let activeStream: MediaStream | undefined

    async function setupInitialStream() {
      try {
        const selectedDeviceId = typeof window !== 'undefined'
          ? localStorage.getItem('selectedVideoDevice')
          : null

        const constraints = selectedDeviceId
          ? { video: { deviceId: selectedDeviceId }, audio: true }
          : { video: true, audio: true }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        setLocalStream(stream)
        activeStream = stream
      } catch (error) {
        setLocalStream(undefined)
      }
    }

    setupInitialStream()

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [setLocalStream])
}

export function WebRTCProvider({ 
  children, 
}: WebRTCProviderProps) {
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false)
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream>()
  const remoteVideoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>
  const [callUser] = useMutation(CALL_USER)
  const {applyLocalQuality, sendWantedMediaStateImpl} = useWebRTCCommon(callUser)
  const { subscribeToCallEvents } = useSubscriptions()

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
  }))

  const attemptReconnect = async () => {
    if (!targetUser) {
      throw new Error('target user set to null')
    }
    console.log('Attempting to reconnect to previous call:', { targetUser, callId, role })
    try {
      if (role === 'caller') {
        await caller.doCall(targetUser, true, meetingId, meetingLastCallTime)
      } else {
        await callUser({
          variables: {
            input: {
              type: 'need-reconnect',
              targetUserId: targetUser._id,
              initiatorUserId: currentUser?._id,
              callId
            }
          }
        })
      }
    } catch (err) {
      console.error('Failed to reconnect:', err)
      clearCallState()
    }
  }
  const childProps = {
    localStream,
    remoteVideoRef,
    callUser,
    attemptReconnect
  }
  
  const caller = useWebRTCCaller(childProps)
  const callee = useWebRTCCallee(childProps)

  // Attempt reconnection on mount if we have stored call state
  useEffect(() => {
    if (connectionStatus !== 'need-reconnect' || !localStream) return;
    setConnectionStatus('reconnecting')
    attemptReconnect()
  }, [connectionStatus, localStream])

  // Initialize localStream from selected video device on mount
  useInitializeLocalStream(setLocalStream)

  useEffect(() => {
    const unsubscribe = subscribeToCallEvents(async (callEvent) => {
      if (callEvent.type !== 'initiate' && callEvent.callId !== callId) {
        console.log('WebRTC: Ignoring connection request - mismatched IDs: ', { callEvent, callId })
        return
      }

      if (callEvent.type === 'initiate') {
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
          setConnectionStatus('receiving-call')
          callee.active = true
        }
      } else if (callEvent.type === 'need-reconnect') {
        console.log('WebRTC: Received need-reconnect request, reconnecting')
        setConnectionStatus('reconnecting')
        await caller.doCall( callEvent.from, true, meetingId, meetingLastCallTime )
      } else if (callEvent.type === 'finished') {
        console.log('WebRTC: Received finished request, cleaning up')
        // Handle finished status
        if (caller.active) {
          await caller.cleanup()
        } else if (callee.active) {
          await callee.cleanup()
        }
        setConnectionStatus('finished')
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
        if ( connectionStatus === 'reconnecting' || connectionStatus === 'connected' ) {
          console.log('WebRTC: Reconnecting, automatically accepting call')
          callee.handleAcceptCall(callEvent as IncomingRequest)
        }
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
      // Handle track changes
      else if (callEvent.type === 'updateMediaState') {
        console.log('WebRTC: updateMediaState')
        setRemoteVideoEnabled(callEvent.videoEnabled ?? remoteVideoEnabled)
        setRemoteAudioEnabled(callEvent.audioEnabled ?? remoteAudioEnabled)
        const quality = callEvent.quality as VideoQuality
        const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null
        if (activePeerConnection) {
          applyLocalQuality(activePeerConnection, quality).catch(err => 
            console.error('WebRTC: Failed to apply quality settings:', err)
          )
        }
      }
      else if (callEvent.type === 'expired') { // Handle expired connection
        console.log('WebRTC: Received expired signal, cleaning up')
        callee.cleanup()
        setConnectionStatus('timeout')
        setRemoteVideoEnabled(false)
        setRemoteAudioEnabled(false)
        clearCallState()
      } 
      else if (callEvent.type === 'busy') { // Handle busy signal
        console.log('WebRTC: Received busy signal')
        if (caller.active) {
          await caller.cleanup()
        
          setConnectionStatus('busy')
          setRemoteVideoEnabled(false)
          setRemoteAudioEnabled(false)
          clearCallState()
        }
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
    if (!localStream) return

    // Get the active peer connection from either caller or callee
    const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null
    if (!activePeerConnection) return

    // Update tracks in the active peer connection
    const senders = activePeerConnection.getSenders()
    localStream.getTracks().forEach(track => {
      const sender = senders.find(s => s.track?.kind === track.kind)
      if (sender) {
        sender.replaceTrack(track)
      }
    })
  }, [localStream, caller.active, caller.peerConnection, callee.active, callee.peerConnection])

  // Handle media state changes (video/audio/quality)
  const sendWantedMediaState = () => {
    const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null
    if (!callId || !activePeerConnection || !targetUser || !(caller.active || callee.active)) return

    const { localVideoEnabled, localAudioEnabled, qualityWeWantFromRemote } = syncStore()

    sendWantedMediaStateImpl(
      activePeerConnection,
      localVideoEnabled,
      localAudioEnabled,
      targetUser._id,
      qualityWeWantFromRemote,
      callId
    )
  }

  const hangup = async () => {
    if (caller.active) {
      await caller.hangup()
    } else if (callee.active) {
      await callee.hangup()
    }
    setConnectionStatus('finished')
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

  const value: WebRTCContextType = {
    doCall: caller.doCall,
    connectionStatus: connectionStatus || 'disconnected',
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
    caller
  }

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  )
} 