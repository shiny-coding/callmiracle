import { useState, createContext, useContext, ReactNode } from 'react'
import { useSubscription, useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useStore } from '@/store/useStore'
import { useWebRTCCaller } from './useWebRTCCaller'
import { useWebRTCCallee } from './useWebRTCCallee'
import { ON_CONNECTION_REQUEST, CONNECT_WITH_USER, type ConnectionStatus, type IncomingRequest } from './useWebRTCCommon'

interface WebRTCContextType {
  doCall: (userId: string) => Promise<void>
  connectionStatus: ConnectionStatus
  incomingRequest: IncomingRequest | null
  handleAcceptCall: () => void
  handleRejectCall: () => void
  hangup: () => Promise<void>
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

  const hangup = async () => {
    console.log('WebRTC: Hanging up call')
    if (caller.active) {
      await caller.hangup()
    } else if (callee.active) {
      await callee.hangup()
    }
    setConnectionStatus('finished')
  }

  // Subscribe to incoming connection requests
  useSubscription(ON_CONNECTION_REQUEST, {
    variables: { userId: getUserId() },
    onSubscriptionData: async ({ subscriptionData }) => {
      const request = subscriptionData.data?.onConnectionRequest
      if (request) {
        console.log('WebRTC: Processing connection request:', { from: request.from.name, type: request.type, })
        
        // Handle finished status
        if (request.type === 'finished') {
          // Don't send finished signal back when receiving finished
          if (caller.active) {
            caller.cleanup()
          } else if (callee.active) {
            callee.cleanup()
          }
          setConnectionStatus('finished')

        } else if (request.type === 'answer') { // Handle answer for initiator
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

  return (
    <WebRTCContext.Provider 
      value={{ 
        doCall: caller.doCall, 
        connectionStatus, 
        incomingRequest: callee.incomingRequest, 
        handleAcceptCall: callee.handleAcceptCall, 
        handleRejectCall: callee.handleRejectCall,
        hangup
      }}
    >
      {children}
    </WebRTCContext.Provider>
  )
} 