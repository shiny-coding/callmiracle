'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { STUN_SERVERS } from '@/constants/webrtc'

export type P2PStatus = 'online' | 'offline' | 'checking' | 'online-blocked'

export interface NetworkDiagnostics {
  hostCandidates: number
  srflxCandidates: number
  relayCandidates: number
  totalCandidates: number
  connectionType?: string
  effectiveType?: string
  downlink?: number
  rtt?: number
}

export function useP2PConnectivityCheck() {
  const [status, setStatus] = useState<P2PStatus>('checking')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [diagnostics, setDiagnostics] = useState<NetworkDiagnostics | null>(null)
  const checkInProgressRef = useRef(false)

  const checkP2PConnectivity = useCallback(async () => {
    // Prevent concurrent checks
    if (checkInProgressRef.current) {
      return
    }

    checkInProgressRef.current = true
    setStatus('checking')

    try {
      // Check if browser supports WebRTC
      if (!window.RTCPeerConnection) {
        setStatus('online-blocked')
        setIsDialogOpen(true)
        return
      }

      // Create a peer connection with STUN servers
      const pc = new RTCPeerConnection({
        iceServers: STUN_SERVERS.map(url => ({ urls: url })),
        iceCandidatePoolSize: 10, // Pre-gather candidates
      })

      let hasPublicIP = false
      let candidateTimeout: NodeJS.Timeout
      const networkDiagnostics: NetworkDiagnostics = {
        hostCandidates: 0,
        srflxCandidates: 0,
        relayCandidates: 0,
        totalCandidates: 0,
      }

      // Get network information if available
      if ('connection' in navigator) {
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
        if (connection) {
          networkDiagnostics.connectionType = connection.type
          networkDiagnostics.effectiveType = connection.effectiveType
          networkDiagnostics.downlink = connection.downlink
          networkDiagnostics.rtt = connection.rtt
        }
      }

      // Listen for ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate
          networkDiagnostics.totalCandidates++

          // Check if we got a public IP (srflx = server reflexive)
          // Note: We only check srflx, NOT relay, because we don't use TURN servers
          if (candidate.includes('srflx')) {
            networkDiagnostics.srflxCandidates++
            hasPublicIP = true
          } else if (candidate.includes('relay')) {
            networkDiagnostics.relayCandidates++
            // Don't set hasPublicIP for relay since we don't use TURN servers
          } else if (candidate.includes('host')) {
            networkDiagnostics.hostCandidates++
          }
        }
      }

      // Create a data channel to force ICE candidate generation
      // Without this, some browsers might not generate candidates
      pc.createDataChannel('p2p-check')

      // Create offer to trigger ICE gathering
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering to complete or timeout
      await new Promise<void>((resolve) => {
        candidateTimeout = setTimeout(() => resolve(), 10000) // 10 second timeout

        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(candidateTimeout)
            resolve()
          }
        }
      })

      // Clean up
      pc.close()

      // Store diagnostics
      setDiagnostics(networkDiagnostics)

      // Determine status
      if (hasPublicIP) {
        setStatus('online')
      } else {
        setStatus('online-blocked')
        setIsDialogOpen(true)
      }
    } catch (error) {
      console.error('P2P connectivity check failed:', error)
      setStatus('offline')
      setDiagnostics(null)
      setIsDialogOpen(true)
    } finally {
      checkInProgressRef.current = false
    }
  }, [])

  // Initial check on mount
  useEffect(() => {
    checkP2PConnectivity()
  }, [checkP2PConnectivity])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      checkP2PConnectivity()
    }

    const handleOffline = () => {
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkP2PConnectivity])

  // Listen for network changes (connection type changes)
  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

      if (connection) {
        const handleConnectionChange = () => {
          checkP2PConnectivity()
        }

        connection.addEventListener('change', handleConnectionChange)

        return () => {
          connection.removeEventListener('change', handleConnectionChange)
        }
      }
    }
  }, [checkP2PConnectivity])

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false)
  }, [])

  const openDialog = useCallback(() => {
    setIsDialogOpen(true)
  }, [])

  const recheckManually = useCallback(() => {
    // Keep dialog open and just recheck
    checkP2PConnectivity()
  }, [checkP2PConnectivity])

  return {
    status,
    isDialogOpen,
    diagnostics,
    closeDialog,
    openDialog,
    recheckManually,
    checkP2PConnectivity,
  }
}
