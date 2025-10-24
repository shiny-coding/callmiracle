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

const P2P_CHECK_STORAGE_KEY = 'p2p-connectivity-checked'
const P2P_STATUS_STORAGE_KEY = 'p2p-connectivity-status'
const P2P_DIAGNOSTICS_STORAGE_KEY = 'p2p-connectivity-diagnostics'

const getInitialStatus = (): P2PStatus => {
  if (typeof window === 'undefined') return 'checking'
  const stored = sessionStorage.getItem(P2P_STATUS_STORAGE_KEY)
  return (stored as P2PStatus) || 'checking'
}

const getInitialDiagnostics = (): NetworkDiagnostics | null => {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem(P2P_DIAGNOSTICS_STORAGE_KEY)
  try {
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function useP2PConnectivityCheck() {
  const [status, setStatus] = useState<P2PStatus>(getInitialStatus)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [diagnostics, setDiagnostics] = useState<NetworkDiagnostics | null>(getInitialDiagnostics)
  const checkInProgressRef = useRef(false)

  // Use sessionStorage instead of ref so it persists across component remounts
  // IMPORTANT: Only consider it checked if we have BOTH the flag AND the actual status
  const hasValidStoredResult = typeof window !== 'undefined' &&
    sessionStorage.getItem(P2P_CHECK_STORAGE_KEY) === 'true' &&
    sessionStorage.getItem(P2P_STATUS_STORAGE_KEY) !== null

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
      const finalStatus = hasPublicIP ? 'online' : 'online-blocked'

      if (hasPublicIP) {
        setStatus('online')
      } else {
        setStatus('online-blocked')
        setIsDialogOpen(true)
      }

      // Store status and diagnostics in sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(P2P_STATUS_STORAGE_KEY, finalStatus)
        sessionStorage.setItem(P2P_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(networkDiagnostics))
      }
    } catch (error) {
      console.error('P2P connectivity check failed:', error)
      setStatus('offline')
      setDiagnostics(null)

      // Store offline status in sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(P2P_STATUS_STORAGE_KEY, 'offline')
        sessionStorage.removeItem(P2P_DIAGNOSTICS_STORAGE_KEY)
      }
      setIsDialogOpen(true)
    } finally {
      checkInProgressRef.current = false
      // Mark check as complete in sessionStorage (persists across component remounts)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(P2P_CHECK_STORAGE_KEY, 'true')
      }
    }
  }, [])

  // Initial check on mount - only run once per session
  useEffect(() => {
    if (!hasValidStoredResult) {
      // Clean up incomplete/old sessionStorage data if it exists
      if (typeof window !== 'undefined') {
        const hasOldFlag = sessionStorage.getItem(P2P_CHECK_STORAGE_KEY) === 'true'
        const hasStatus = sessionStorage.getItem(P2P_STATUS_STORAGE_KEY) !== null

        if (hasOldFlag && !hasStatus) {
          sessionStorage.removeItem(P2P_CHECK_STORAGE_KEY)
        }
      }

      checkP2PConnectivity()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount, check sessionStorage inside

  // Removed automatic network event listeners - only check on initial mount or manual recheck
  // Users reported that P2P check was being re-triggered after calls ended
  // Now only checks once on page load or when user manually clicks recheck button

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false)
  }, [])

  const openDialog = useCallback(() => {
    setIsDialogOpen(true)
  }, [])

  const recheckManually = useCallback(() => {
    // Keep dialog open and just recheck
    // Clear all sessionStorage flags so the check runs and stores new results
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(P2P_CHECK_STORAGE_KEY)
      sessionStorage.removeItem(P2P_STATUS_STORAGE_KEY)
      sessionStorage.removeItem(P2P_DIAGNOSTICS_STORAGE_KEY)
    }
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
