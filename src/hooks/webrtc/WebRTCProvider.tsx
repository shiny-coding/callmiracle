import { useState, createContext, useContext, ReactNode } from 'react'
import { useSubscription } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useStore } from '@/store/useStore'
import { useWebRTCCaller } from './useWebRTCCaller'
import { useWebRTCCallee } from './useWebRTCCallee'
import { ON_CONNECTION_REQUEST, type ConnectionStatus, type IncomingRequest } from './useWebRTCCommon'

interface WebRTCContextType {
  doCall: (userId: string) => Promise<void>
  connectionStatus: ConnectionStatus
  incomingRequest: IncomingRequest | null
  handleAcceptCall: () => void
  handleRejectCall: () => void
  resetConnection: () => void
}

interface WebRTCProviderProps {
  children: ReactNode
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  localVideoEnabled?: boolean
  localAudioEnabled?: boolean
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
  localStream, 
  remoteVideoRef, 
  localVideoEnabled = true,
  localAudioEnabled = true 
}: WebRTCProviderProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  const childProps = {
    localStream,
    remoteVideoRef,
    localVideoEnabled,
    localAudioEnabled,
    onStatusChange: setConnectionStatus
  }
  const caller = useWebRTCCaller(childProps)
  const callee = useWebRTCCallee(childProps)

  // Subscribe to incoming connection requests
  useSubscription(ON_CONNECTION_REQUEST, {
    variables: { userId: getUserId() },
    onSubscriptionData: async ({ subscriptionData }) => {
      const request = subscriptionData.data?.onConnectionRequest
      if (request) {
        console.log('WebRTC: Processing connection request:', {
          from: request.from.name,
          type: request.type,
          hasOffer: !!request.offer,
          hasIceCandidate: !!request.iceCandidate,
          timestamp: new Date().toISOString()
        })
        
        // Handle finished status
        if (request.type === 'finished') {
          cleanup()

        } else if (request.type === 'answer') { // Handle answer for initiator
          if (!caller.active) {
            throw new Error('WebRTC: Not in caller mode, ignoring answer')
          }
          const answer = JSON.parse(request.answer)
          await caller.handleAnswer(caller.peerConnection.current!, answer)

        } else if (request.type === 'ice-candidate') { // Handle ICE candidates
          const candidate = JSON.parse(request.iceCandidate)
          if (caller.active) {
            // We're the caller
            await caller.handleIceCandidate(caller.peerConnection.current!, candidate)
          } else {
            // We're the callee
            await callee.handleIceCandidate(callee.peerConnection.current!, candidate)
          }

        } else if (request.type === 'offer') { // Handle new call request
          if (caller.active) {
            console.log('WebRTC: Already in a call, ignoring offer')
            return
          }
          callee.setIncomingRequest(request)
          setConnectionStatus('calling')

        } else {
          throw new Error('WebRTC: Unknown request type:', request.type)
        }
      }
    }
  })

  const cleanup = () => {
    if (caller.active) {
      // We're the caller
      caller.cleanup()
    } else if (callee.incomingRequest?.from.userId) {
      // We're the callee
      callee.cleanup()
    }
    setConnectionStatus('finished')
  }

  const resetConnection = () => {
    console.log('WebRTC: Resetting connection')
    if (caller.active || callee.incomingRequest?.from.userId) {
      cleanup()
    }
  }

  return (
    <WebRTCContext.Provider 
      value={{ 
        doCall: caller.doCall, 
        connectionStatus, 
        incomingRequest: callee.incomingRequest, 
        handleAcceptCall: callee.handleAcceptCall, 
        handleRejectCall: callee.handleRejectCall,
        resetConnection
      }}
    >
      {children}
    </WebRTCContext.Provider>
  )
} 