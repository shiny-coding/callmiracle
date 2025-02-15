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

interface WebRTCContextType {
  doCall: (userId: string) => Promise<void>
  connectionStatus: ConnectionStatus
  incomingRequest: IncomingRequest | null
  handleAcceptCall: () => void
  handleRejectCall: () => void
  hangup: () => Promise<void>
  remoteVideoEnabled: boolean
  remoteAudioEnabled: boolean
  remoteName: string | null
  remoteQuality: VideoQuality | null
  localStream: MediaStream | undefined
  setLocalStream: (stream: MediaStream | undefined) => void
  localVideoEnabled: boolean
  setLocalVideoEnabled: (enabled: boolean) => void
  localAudioEnabled: boolean
  setLocalAudioEnabled: (enabled: boolean) => void
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  handleAudioToggle: () => void
  handleVideoToggle: () => void
  updateRemoteQuality: (quality: VideoQuality) => Promise<void>
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
  const [remoteName, setRemoteName] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream>()
  const remoteVideoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const { applyRemoteQuality, updateMediaState } = useWebRTCCommon()

  const { 
    callId, 
    connectionStatus, 
    targetUserId, 
    role,
    setConnectionStatus,
    setTargetUserId,
    setRole,
    clearCallState,
    setLocalAudioEnabled,
    setLocalVideoEnabled,
    setRemoteQuality,
    localVideoEnabled,
    localAudioEnabled,
    remoteQuality
  } = useStore()

  const childProps = {
    localStream,
    remoteVideoRef,
    localVideoEnabled,
    localAudioEnabled,
  }
  const caller = useWebRTCCaller(childProps)
  const callee = useWebRTCCallee(childProps)

  // Attempt reconnection on mount if we have stored call state
  useEffect(() => {
    const attemptReconnect = async () => {
      if (connectionStatus === 'reconnecting' && targetUserId && callId && role) {
        console.log('Attempting to reconnect to previous call:', {
          targetUserId,
          callId,
          role
        })

        try {
          setConnectionStatus('connecting')

          if (role === 'caller' && targetUserId) {
            await caller.doCall(targetUserId, true)
          } else if (role === 'callee' && targetUserId) {
            await connectWithUser({
              variables: {
                input: {
                  type: 'reconnect',
                  targetUserId,
                  initiatorUserId: getUserId(),
                  callId,
                  videoEnabled: localVideoEnabled,
                  audioEnabled: localAudioEnabled
                }
              }
            })
          }
        } catch (err) {
          console.error('Failed to reconnect:', err)
          clearCallState()
        }
      }
    }

    attemptReconnect()
  }, [])

  // Subscribe to incoming connection requests
  useSubscription(ON_CONNECTION_REQUEST, {
    variables: { userId: getUserId() },
    onSubscriptionData: async ({ subscriptionData }) => {
      const request = subscriptionData.data?.onConnectionRequest
      if (!request) return

      // Handle reconnection request
      if (request.type === 'reconnect') {
        if (request.callId === callId && request.from.userId === targetUserId && targetUserId) {
          console.log('WebRTC: Reconnection request received')
          if (role === 'caller') {
            await caller.doCall(targetUserId, true)
          }
        } else {
          console.log('WebRTC: Ignoring reconnection - mismatched IDs')
        }
      }
      // Handle finished status
      else if (request.type === 'finished') {
        if (caller.active) {
          await caller.hangup()
        } else if (callee.active) {
          await callee.cleanup()
        }
        setConnectionStatus('finished')
        setRemoteVideoEnabled(false)
        setRemoteAudioEnabled(false)
        setRemoteName(null)
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
          await caller.handleAnswer(caller.peerConnection.current, answer)
          setRemoteVideoEnabled(request.videoEnabled ?? true)
          setRemoteAudioEnabled(request.audioEnabled ?? true)
          setRemoteName(request.from.name)
        }
      }
      // Handle offer
      else if (request.type === 'offer') {
        if (!caller.active) {
          setRemoteVideoEnabled(request.videoEnabled ?? true)
          setRemoteAudioEnabled(request.audioEnabled ?? true)
          setRemoteName(request.from.name)
          callee.setIncomingRequest(request)
          setConnectionStatus('calling')
          setTargetUserId(request.from.userId)
          setRole('callee')
        } else {
          console.log('WebRTC: Ignoring offer - already in call')
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
      else if (request.type === 'changeTracks') {
        setRemoteVideoEnabled(request.videoEnabled ?? remoteVideoEnabled)
        setRemoteAudioEnabled(request.audioEnabled ?? remoteAudioEnabled)
        const quality = request.quality as VideoQuality
        setRemoteQuality(quality)
        const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null
        if (activePeerConnection) {
          applyRemoteQuality(activePeerConnection, quality).catch(err => 
            console.error('WebRTC: Failed to apply quality settings:', err)
          )
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
  useEffect(() => {
    const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null
    if (!activePeerConnection || !targetUserId || !(caller.active || callee.active)) return

    updateMediaState(
      activePeerConnection,
      localVideoEnabled,
      localAudioEnabled,
      targetUserId,
      connectWithUser,
      remoteQuality,
      callId
    )
  }, [
    localVideoEnabled,
    localAudioEnabled,
    remoteQuality,
  ])

  const handleAudioToggle = () => {
    setLocalAudioEnabled(!localAudioEnabled)
  }

  const handleVideoToggle = () => {
    setLocalVideoEnabled(!localVideoEnabled)
  }

  const updateRemoteQuality = async (remoteQuality: VideoQuality) => {
    if (!caller.active && !callee.active) return
    if (!targetUserId) return

    console.log('WebRTC: Updating remote quality to:', remoteQuality)
    setRemoteQuality(remoteQuality)

    await connectWithUser({
      variables: {
        input: {
          type: 'changeTracks',
          targetUserId,
          initiatorUserId: getUserId(),
          videoEnabled: localVideoEnabled,
          audioEnabled: localAudioEnabled,
          quality: remoteQuality
        }
      }
    })
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
    setRemoteName(null)
    clearCallState()
  }

  const value: WebRTCContextType = {
    doCall: caller.doCall,
    connectionStatus: connectionStatus || 'disconnected',
    incomingRequest: callee.incomingRequest,
    handleAcceptCall: callee.handleAcceptCall,
    handleRejectCall: callee.handleRejectCall,
    hangup,
    remoteVideoEnabled,
    remoteAudioEnabled,
    remoteName,
    remoteQuality,
    localStream,
    setLocalStream,
    localVideoEnabled,
    setLocalVideoEnabled,
    localAudioEnabled,
    setLocalAudioEnabled,
    remoteVideoRef,
    handleAudioToggle,
    handleVideoToggle,
    updateRemoteQuality,
  }

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  )
} 