  'use client'
import { useState, createContext, useContext, ReactNode, useRef, useEffect } from 'react'
import { useSubscription, useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useStore } from '@/store/useStore'
import { useWebRTCCaller } from './useWebRTCCaller'
import { useWebRTCCallee } from './useWebRTCCallee'
import { ON_CONNECTION_REQUEST, CONNECT_WITH_USER, type ConnectionStatus, type IncomingRequest } from './useWebRTCCommon'
import { QUALITY_CONFIGS, type VideoQuality } from '@/components/VideoQualitySelector'
import { useWebRTCCommon } from './useWebRTCCommon'
import CalleeDialog from '@/components/CalleeDialog'
import { User } from '@/generated/graphql'
interface WebRTCContextType {
  doCall: (user: User, meetingId: string | null) => Promise<void>
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
  connectWithUser: any
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

export function WebRTCProvider({ 
  children, 
}: WebRTCProviderProps) {
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false)
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream>()
  const remoteVideoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const {applyLocalQuality, sendWantedMediaStateImpl} = useWebRTCCommon(connectWithUser)

  const { 
    callId, 
    connectionStatus, 
    targetUser, 
    role,
    setConnectionStatus,
    setTargetUser,
    setRole,
    clearCallState,
    setCallId,
    activeMeetingId,
    setActiveMeetingId
  } = useStore()

  const attemptReconnect = async () => {
    if (!targetUser) {
      throw new Error('target user set to null')
    }
    console.log('Attempting to reconnect to previous call:', { targetUser, callId, role })
    try {
      if (role === 'caller') {
        await caller.doCall(targetUser, activeMeetingId, true)
      } else {
        await connectWithUser({
          variables: {
            input: {
              type: 'need-reconnect',
              targetUserId: targetUser.userId,
              initiatorUserId: getUserId(),
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
    connectWithUser,
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

  // Subscribe to incoming connection requests
  useSubscription(ON_CONNECTION_REQUEST, {
    variables: { userId: getUserId() },
    onSubscriptionData: async ({ subscriptionData }) => {
      const request = subscriptionData.data?.onConnectionRequest
      if (!request) return

      if (request.type !== 'initiate' && request.callId !== callId) {
        console.log('WebRTC: Ignoring connection request - mismatched IDs: ', { request, callId })
        return
      }

      if (request.type === 'initiate') {
        if (callId) {
          // Already in a call, send busy response
          console.log('WebRTC: Already in call, sending busy signal')
          setTimeout(async () => {
            await connectWithUser({
              variables: {
                input: {
                type: 'busy',
                targetUserId: request.from.userId,
                initiatorUserId: getUserId(),
                callId: request.callId
              }
              }
            })
          }, 1000) // we're not immediately sending the busy, so that the callee has time to receive the callId (sic!)
        } else {
          // Set up for receiving call
          console.log('WebRTC: Received initiate request')
          setCallId(request.callId)
          setTargetUser(request.from)
          setRole('callee')
          setConnectionStatus('receiving-call')
          callee.active = true
        }
      } else if (request.type === 'need-reconnect') {
        console.log('WebRTC: Received need-reconnect request, reconnecting')
        setConnectionStatus('reconnecting')
        await caller.doCall( request.from, activeMeetingId, true )
      } else if (request.type === 'finished') {
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
      else if (request.type === 'answer') {
        if (!caller.peerConnection.current) {
          console.log('WebRTC: Connection closed before answer')
          await connectWithUser({
            variables: {
              input: {
                type: 'expired',
                targetUserId: request.from.userId,
                initiatorUserId: getUserId(),
                callId
              }
            }
          })
        } else {
          console.log('WebRTC: Processing answer')
          const answer = JSON.parse(request.answer)
          setRemoteVideoEnabled(request.videoEnabled)
          setRemoteAudioEnabled(request.audioEnabled)
          await caller.handleAnswer(caller.peerConnection.current, request.quality, answer)
        }
      }
      // Handle offer
      else if (request.type === 'offer') {
        setRemoteVideoEnabled(request.videoEnabled)
        setRemoteAudioEnabled(request.audioEnabled)
        callee.setIncomingRequest(request)
        if ( connectionStatus === 'reconnecting' || connectionStatus === 'connected' ) {
          console.log('WebRTC: Reconnecting, automatically accepting call')
          callee.handleAcceptCall(request)
        }
      }
      // Handle ICE candidates
      else if (request.type === 'ice-candidate') {
        const candidate = JSON.parse(request.iceCandidate)
        if (caller.active) {
          await caller.handleIceCandidate(caller.peerConnection.current!, candidate)
        } else { // we're not checking calee.active because we can receive candidates before callee becomes active after accepting the call
          await callee.handleIceCandidate(callee.peerConnection.current!, candidate)
        }
      }
      // Handle track changes
      else if (request.type === 'updateMediaState') {
        console.log('WebRTC: updateMediaState')
        setRemoteVideoEnabled(request.videoEnabled ?? remoteVideoEnabled)
        setRemoteAudioEnabled(request.audioEnabled ?? remoteAudioEnabled)
        const quality = request.quality as VideoQuality
        const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null
        if (activePeerConnection) {
          applyLocalQuality(activePeerConnection, quality).catch(err => 
            console.error('WebRTC: Failed to apply quality settings:', err)
          )
        }
      }
      else if (request.type === 'expired') { // Handle expired connection
        console.log('WebRTC: Received expired signal, cleaning up')
        callee.cleanup()
        setConnectionStatus('timeout')
        setRemoteVideoEnabled(false)
        setRemoteAudioEnabled(false)
        clearCallState()
      } 
      else if (request.type === 'busy') { // Handle busy signal
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
        throw new Error(`WebRTC: Unknown request type: ${request.type}`)
      }
    }
  })

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

    const { localVideoEnabled, localAudioEnabled, qualityWeWantFromRemote } = useStore.getState()

    sendWantedMediaStateImpl(
      activePeerConnection,
      localVideoEnabled,
      localAudioEnabled,
      targetUser.userId,
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
    connectWithUser,
    callee,
    caller
  }

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  )
} 