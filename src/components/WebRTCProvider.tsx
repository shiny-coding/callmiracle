import { createContext, useContext, ReactNode, useState } from 'react'
import { useWebRTC } from '@/hooks/useWebRTC'

interface WebRTCContextType {
  doCall: (userId: string) => Promise<void>
  connectionStatus: string
  incomingRequest: any // TODO: type this properly
  handleAcceptCall: () => void
  handleRejectCall: () => void
}

export const WebRTCContext = createContext<WebRTCContextType | null>(null)

export function useWebRTCContext() {
  const context = useContext(WebRTCContext)
  if (!context) {
    throw new Error('useWebRTCContext must be used within a WebRTCProvider')
  }
  return context
}

interface WebRTCProviderProps {
  children: ReactNode
  localStream?: MediaStream
  remoteVideoRef: React.RefObject<HTMLVideoElement>
}

export function WebRTCProvider({ children, localStream, remoteVideoRef }: WebRTCProviderProps) {
  const { 
    connectionStatus, 
    incomingRequest, 
    handleAcceptCall, 
    handleRejectCall,
    doCall
  } = useWebRTC({
    localStream,
    remoteVideoRef
  })

  return (
    <WebRTCContext.Provider 
      value={{ 
        doCall, 
        connectionStatus, 
        incomingRequest, 
        handleAcceptCall, 
        handleRejectCall,
      }}
    >
      {children}
    </WebRTCContext.Provider>
  )
} 