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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false)
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(false)
  const [remoteName, setRemoteName] = useState<string | null>(null)
  const [remoteQuality, setRemoteQuality] = useState<VideoQuality | null>(null)
  const [localQuality, setLocalQuality] = useState<VideoQuality>('720p')
  const [localStream, setLocalStream] = useState<MediaStream>()
  const [localVideoEnabled, setLocalVideoEnabled] = useState(false)
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false)
  const remoteVideoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>
  const [connectWithUser] = useMutation(CONNECT_WITH_USER)
  const { applyRemoteQuality } = useWebRTCCommon()

  // Initialize client-side only states
  useEffect(() => {
    setLocalVideoEnabled(localStorage.getItem('cameraEnabled') !== 'false')
    setLocalAudioEnabled(localStorage.getItem('audioEnabled') !== 'false')
    const savedQuality = localStorage.getItem('remoteQuality') as VideoQuality
    if (savedQuality && QUALITY_CONFIGS[savedQuality]) {
      setRemoteQuality(savedQuality)
    }
  }, [])

  useEffect(() => {
    console.log('WebRTCProvider mounted')
    return () => console.log('WebRTCProvider unmounted')
  }, [])

  const childProps = {
    localStream,
    remoteVideoRef,
    localVideoEnabled,
    localAudioEnabled,
    localQuality,
    onStatusChange: setConnectionStatus
  }
  const caller = useWebRTCCaller(childProps)
  const callee = useWebRTCCallee(childProps)

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
  }

  // Subscribe to incoming connection requests
  useSubscription(ON_CONNECTION_REQUEST, {
    variables: { userId: getUserId() },
    onSubscriptionData: async ({ subscriptionData }) => {
      const request = subscriptionData.data?.onConnectionRequest
      if (request) {
        console.log('WebRTC: Processing connection request:', { from: request.from.name, type: request.type })
        
        if (request.type === 'ignore') {
          console.log('WebRTC: Ignoring request:', { from: request.from.name, type: request.type })
          return
        }

        // Handle finished status
        if (request.type === 'finished') {
          // Don't send finished signal back when receiving finished
          if (caller.active) {
            caller.cleanup()
          } else if (callee.active) {
            callee.cleanup()
          }
          setConnectionStatus('finished')
          setRemoteVideoEnabled(false)
          setRemoteAudioEnabled(false)
          setRemoteName(null)

        } else if (request.type === 'answer') { // Handle answer for initiator
          const answer = JSON.parse(request.answer)
          if (!caller.peerConnection.current) {
            // Connection already closed, send expired
            console.log('WebRTC: Connection already closed, sending expired')
            await connectWithUser({
              variables: {
                input: {
                  type: 'expired',
                  targetUserId: request.from.userId,
                  initiatorUserId: getUserId()
                }
              }
            })
            return
          }
          await caller.handleAnswer(caller.peerConnection.current, answer)
          // Initialize remote media state from answer
          setRemoteVideoEnabled(request.videoEnabled ?? true)
          setRemoteAudioEnabled(request.audioEnabled ?? true)
          setRemoteName(request.from.name)

        } else if (request.type === 'expired') { // Handle expired connection
          console.log('WebRTC: Received expired signal, cleaning up')
          if (callee.active) {
            callee.cleanup()
          }
          setConnectionStatus('timeout')
          setRemoteVideoEnabled(false)
          setRemoteAudioEnabled(false)
          setRemoteName(null)

        } else if (request.type === 'ice-candidate') { // Handle ICE candidates
          const candidate = JSON.parse(request.iceCandidate)
          if (caller.active) {
            // We're the caller
            await caller.handleIceCandidate(caller.peerConnection.current!, candidate)
          } else {
            // We're the callee (supposedly)
            await callee.handleIceCandidate(callee.peerConnection.current!, candidate)
          }

        } else if (request.type === 'offer') { // Handle new call request
          if (caller.active) {
            console.log('WebRTC: Already in a call, ignoring offer')
            return
          }
          // Initialize remote media state from offer
          setRemoteVideoEnabled(request.videoEnabled ?? true)
          setRemoteAudioEnabled(request.audioEnabled ?? true)
          setRemoteName(request.from.name)
          callee.setIncomingRequest(request)
          setConnectionStatus('calling')

        } else if (request.type === 'changeTracks') { // Handle track changes
          console.log('WebRTC: Remote peer changed tracks:', {
            from: request.from.name,
            videoEnabled: request.videoEnabled ?? remoteVideoEnabled,
            audioEnabled: request.audioEnabled ?? remoteAudioEnabled,
            quality: request.quality || 'unchanged'
          })

          // Update remote media state
          setRemoteVideoEnabled(request.videoEnabled ?? remoteVideoEnabled)
          setRemoteAudioEnabled(request.audioEnabled ?? remoteAudioEnabled)
          if (request.quality) {
            const quality = request.quality as VideoQuality
            setRemoteQuality(quality)
            // Apply quality settings to remote stream
            const activePeerConnection = caller.active ? caller.peerConnection.current : callee.active ? callee.peerConnection.current : null
            if (activePeerConnection) {
              applyRemoteQuality(activePeerConnection, quality).catch(err => 
                console.error('Failed to apply remote quality settings:', err)
              )
            }
          }
        } else {
          throw new Error('WebRTC: Unknown request type:', request.type)
        }
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

  const handleAudioToggle = () => {
    const newState = !localAudioEnabled
    setLocalAudioEnabled(newState)
    localStorage.setItem('audioEnabled', String(newState))
  }

  const handleVideoToggle = () => {
    const newState = !localVideoEnabled
    setLocalVideoEnabled(newState)
    localStorage.setItem('cameraEnabled', String(newState))
  }

  const updateRemoteQuality = async (quality: VideoQuality) => {
    if (!caller.active && !callee.active) return

    setRemoteQuality(quality)
    localStorage.setItem('remoteQuality', quality)
    
    const targetUserId = caller.active ? caller.targetUserId! : callee.targetUserId!
    await connectWithUser({
      variables: {
        input: {
          type: 'changeTracks',
          targetUserId,
          initiatorUserId: getUserId(),
          videoEnabled: localVideoEnabled,
          audioEnabled: localAudioEnabled,
          quality
        }
      }
    })
  }

  const value = {
    doCall: caller.doCall, 
    connectionStatus, 
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