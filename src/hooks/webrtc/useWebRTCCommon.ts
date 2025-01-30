import { useRef } from 'react'
import { gql } from '@apollo/client'
import { getUserId } from '@/lib/userId'

export const CONNECTION_TIMEOUT_MS = 10000 // 10 seconds

export const CONNECT_WITH_USER = gql`
  mutation ConnectWithUser($input: ConnectionParamsInput!) {
    connectWithUser(input: $input) {
      offer
      answer
      targetUserId
      initiatorUserId
    }
  }
`

export const ON_CONNECTION_REQUEST = gql`
  subscription OnConnectionRequest($userId: ID!) {
    onConnectionRequest(userId: $userId) {
      type
      offer
      answer
      iceCandidate
      from {
        userId
        name
        languages
        statuses
      }
    }
  }
`

export type ConnectionStatus = 'disconnected' | 'calling' | 'connecting' | 'connected' | 'failed' | 'rejected' | 'timeout' | 'finished'

export interface IncomingRequest {
  offer: string
  iceCandidate: string
  from: {
    userId: string
    name: string
    languages: string[]
    statuses: string[]
  }
}

export function useWebRTCCommon() {
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([])

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
    })

    return pc
  }

  const addLocalStream = (pc: RTCPeerConnection, stream: MediaStream, isInitiator: boolean, localVideoEnabled: boolean, localAudioEnabled: boolean) => {
    console.log('WebRTC: Adding local stream tracks:', {
      trackCount: stream.getTracks().length,
      tracks: stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted
      }))
    })

    if (isInitiator) {
      if (!pc.getTransceivers().length) {
        if (localAudioEnabled) {
          pc.addTransceiver('audio', { direction: 'sendrecv', streams: [stream] })
        }
        if (localVideoEnabled) {
          pc.addTransceiver('video', { direction: 'sendrecv', streams: [stream] })
        }
      }
    }

    for (const track of stream.getTracks()) {
      const existingSender = pc.getSenders().find(s => s.track?.kind === track.kind)
      if (existingSender) {
        if (track.kind === 'video' && !localVideoEnabled) {
          track.enabled = false
          track.stop()
        } else if (track.kind === 'audio' && !localAudioEnabled) {
          track.enabled = false
          track.stop()
        } else {
          existingSender.replaceTrack(track)
        }
      } else if ((track.kind === 'audio' && localAudioEnabled) || (track.kind === 'video' && localVideoEnabled)) {
        pc.addTrack(track, stream)
      }
    }

    configureTransceivers(pc, localVideoEnabled, localAudioEnabled)
  }

  const configureTransceivers = (pc: RTCPeerConnection, localVideoEnabled: boolean, localAudioEnabled: boolean) => {
    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.sender.track?.kind || transceiver.mid
      if (kind === 'video' || kind === '1') {
        if (localVideoEnabled) {
          transceiver.direction = 'sendrecv'
          if (transceiver.sender.setParameters) {
            const params = transceiver.sender.getParameters()
            if (!params.encodings) {
              params.encodings = [{}]
            }
            params.encodings[0].maxBitrate = 2000000 // 2 Mbps
            params.encodings[0].maxFramerate = 30
            transceiver.sender.setParameters(params)
          }
        } else {
          transceiver.direction = 'inactive'
        }
      } else if (kind === 'audio' || kind === '0') {
        transceiver.direction = localAudioEnabled ? 'sendrecv' : 'inactive'
      }
    }
  }

  const handleTrack = (event: RTCTrackEvent, peerConnection: RTCPeerConnection, remoteVideoRef: React.RefObject<HTMLVideoElement>, remoteStreamRef: React.MutableRefObject<MediaStream | null>) => {
    if (!peerConnection) return
    
    console.log('WebRTC: OnTrack', event)
    if (!event.streams[0]?.id.includes(getUserId())) {
      const [remoteStream] = event.streams
      if (remoteStream && remoteVideoRef?.current) {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = remoteStream
          remoteVideoRef.current.srcObject = remoteStream
          console.log('Received first remote track: ' + event.track.kind)
        } else {
          console.log('Added remote track: ' + event.track.kind)
        }
      }
    } else {
      console.log('Ignored local track: ' + event.track.kind)
    }
  }

  const parseCandidate = (candidate: RTCIceCandidateInit) => {
    if (!candidate.candidate) return null
    const parts = candidate.candidate.split(' ')
    return {
      foundation: parts[0].split(':')[1],
      component: parts[1],
      protocol: parts[2].toLowerCase(),
      priority: parseInt(parts[3], 10),
      ip: parts[4],
      port: parseInt(parts[5], 10),
      type: parts[7],
    }
  }

  const setupIceCandidateHandler = (pc: RTCPeerConnection, targetUserId: string, connectWithUser: any) => {
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await connectWithUser({
            variables: {
              input: {
                type: 'ice-candidate',
                targetUserId,
                initiatorUserId: getUserId(),
                iceCandidate: JSON.stringify(event.candidate)
              }
            }
          })
        } catch (err) {
          console.error('WebRTC: Failed to send ICE candidate:', err)
        }
      }
    }
  }

  const handleIceCandidate = async (pc: RTCPeerConnection | null, candidate: RTCIceCandidateInit) => {
    try {
      if (pc?.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(candidate)
      } else {
        pendingIceCandidates.current.push(candidate)
      }
    } catch (err) {
      console.error('WebRTC: Failed to handle ICE candidate:', err)
    }
  }

  const dispatchPendingIceCandidates = async (pc: RTCPeerConnection) => {
    if (pendingIceCandidates.current.length > 0) {
      console.log('WebRTC: Processing pending ICE candidates:', pendingIceCandidates.current.length)
      for (const candidate of pendingIceCandidates.current) {
        await pc.addIceCandidate(candidate)
      }
      pendingIceCandidates.current = []
    }
  }

  const clearPendingCandidates = () => {
    pendingIceCandidates.current = []
  }

  const updateMediaState = (pc: RTCPeerConnection, localVideoEnabled: boolean, localAudioEnabled: boolean) => {
    // Update tracks
    const senders = pc.getSenders()
    for (const sender of senders) {
      const track = sender.track
      if (!track) continue

      if (track.kind === 'video') {
        track.enabled = localVideoEnabled
      } else if (track.kind === 'audio') {
        track.enabled = localAudioEnabled
      }
    }

    // Update transceivers
    configureTransceivers(pc, localVideoEnabled, localAudioEnabled)
  }

  return {
    createPeerConnection,
    addLocalStream,
    configureTransceivers,
    handleTrack,
    parseCandidate,
    setupIceCandidateHandler,
    handleIceCandidate,
    dispatchPendingIceCandidates,
    clearPendingCandidates,
    updateMediaState
  }
} 