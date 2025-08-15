# WebRTC Implementation

## Overview

CallMiracle implements peer-to-peer video calling using **WebRTC** (Web Real-Time Communication) with GraphQL-based signaling. The implementation supports high-quality video/audio calls with adaptive bitrate, device selection, and automatic reconnection.

## Architecture

### WebRTC Flow Diagram
```
Caller                    Signaling Server               Callee
  │                          (GraphQL)                     │
  ├─1. Initiate Call────────────────────────────────────→│
  │                                                        │
  ├─2. Create Offer─────────→│                           │
  │                          ├─3. Forward Offer────────→│
  │                          │                           │
  │                          │←─4. Answer───────────────┤
  │←─5. Forward Answer───────┤                           │
  │                          │                           │
  ├─6. ICE Candidates───────→│←──ICE Candidates─────────┤
  │                          │                           │
  ╰─7. Direct P2P Connection (Media Stream)─────────────╯
```

### Component Structure
```
WebRTCProvider (Context)
├── useWebRTCCommon (Shared logic)
├── useWebRTCCaller (Initiating calls)
├── useWebRTCCallee (Receiving calls)
├── CallerDialog (UI for outgoing calls)
├── CalleeDialog (UI for incoming calls)
├── LocalVideo (Local camera feed)
└── RemoteVideo (Remote user feed)
```

## Core Hooks Implementation

### 1. useWebRTCCommon (Shared Logic)
**File**: `src/hooks/webrtc/useWebRTCCommon.ts`

**Purpose**: Shared WebRTC functionality between caller and callee

**Key Functions**:
```typescript
// Peer connection creation with optimal configuration
const createPeerConnection = () => {
  return new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    iceCandidatePoolSize: 0,
    iceTransportPolicy: 'all',
    bundlePolicy: 'balanced',
    rtcpMuxPolicy: 'require'
  })
}

// Add local media stream with quality settings
const addLocalStream = (
  pc: RTCPeerConnection, 
  stream: MediaStream, 
  isInitiator: boolean, 
  localVideoEnabled: boolean, 
  localAudioEnabled: boolean, 
  localQuality: VideoQuality
) => {
  // Configure transceivers for media
  // Apply quality constraints
  // Handle track replacement
}

// Handle incoming remote media
const handleTrack = (
  event: RTCTrackEvent, 
  peerConnection: RTCPeerConnection, 
  remoteVideoRef: React.RefObject<HTMLVideoElement>
) => {
  // Process remote streams
  // Apply quality settings
  // Update video element
}
```

**Quality Management**:
```typescript
const applyLocalQuality = async (
  peerConnection: RTCPeerConnection, 
  quality: VideoQuality
) => {
  const config = QUALITY_CONFIGS[quality]
  
  // Update track constraints
  await videoTrack.applyConstraints({
    width: { ideal: config.width },
    height: { ideal: config.height },
    frameRate: { max: config.maxFramerate }
  })
  
  // Update encoder parameters
  const params = sender.getParameters()
  params.encodings[0].maxBitrate = config.maxBitrate
  params.encodings[0].maxFramerate = config.maxFramerate
  await sender.setParameters(params)
}
```

### 2. useWebRTCCaller (Outgoing Calls)
**File**: `src/hooks/webrtc/useWebRTCCaller.ts`

**Purpose**: Handle call initiation and management

**Key Flow**:
```typescript
const doCall = async (
  user: User, 
  isReconnect: boolean, 
  meetingId: string | null, 
  meetingLastCallTime: number | null
) => {
  // 1. Initialize call state
  setConnectionStatus('calling')
  setTargetUser(user)
  
  // 2. Get call ID for tracking
  if (!isReconnect) {
    const initResult = await callUser({
      variables: { input: { type: 'initiate', targetUserId: user._id } }
    })
    setCallId(initResult.data.callUser.callId)
  }
  
  // 3. Create peer connection
  const pc = createPeerConnection()
  setupEventHandlers(pc)
  
  // 4. Add local stream
  addLocalStream(pc, localStream, true, videoEnabled, audioEnabled, quality)
  
  // 5. Create and send offer
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await callUser({
    variables: { 
      input: { 
        type: 'offer', 
        targetUserId: user._id,
        offer: JSON.stringify(offer),
        videoEnabled,
        audioEnabled,
        quality
      }
    }
  })
}
```

**Answer Handling**:
```typescript
const handleAnswer = async (
  pc: RTCPeerConnection, 
  quality: VideoQuality, 
  answer: RTCSessionDescriptionInit
) => {
  if (pc.signalingState === 'have-local-offer') {
    setConnectionStatus('connecting')
    setQualityRemoteWantsFromUs(quality)
    applyLocalQuality(pc, quality)
    await pc.setRemoteDescription(new RTCSessionDescription(answer))
    await dispatchPendingIceCandidates(pc)
    
    // Update meeting status to CALLED
    await updateMeetingStatus({
      variables: { input: { _id: meetingId, status: MeetingStatus.Called } }
    })
  }
}
```

### 3. useWebRTCCallee (Incoming Calls)
**File**: `src/hooks/webrtc/useWebRTCCallee.ts`

**Purpose**: Handle incoming call acceptance and management

**Key Flow**:
```typescript
const handleAcceptCall = async (reconnectRequest: IncomingRequest | null = null) => {
  const request = reconnectRequest || incomingRequest
  
  // 1. Setup connection state
  setConnectionStatus('connecting')
  setTargetUser(request.from)
  setCallId(request.callId)
  
  // 2. Create peer connection
  const pc = createPeerConnection()
  setupEventHandlers(pc)
  
  // 3. Add local stream
  addLocalStream(pc, localStream, false, videoEnabled, audioEnabled, request.quality)
  
  // 4. Set remote description (offer)
  const offer = JSON.parse(request.offer)
  await pc.setRemoteDescription(new RTCSessionDescription(offer))
  
  // 5. Create and send answer
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  await callUser({
    variables: {
      input: {
        type: 'answer',
        targetUserId: request.from._id,
        answer: JSON.stringify(answer),
        quality: qualityWeWantFromRemote,
        callId: request.callId
      }
    }
  })
  
  // 6. Process pending ICE candidates
  await dispatchPendingIceCandidates(pc)
}
```

## Signaling Implementation

### GraphQL Mutations
**File**: `src/hooks/webrtc/useWebRTCCommon.ts`

```graphql
mutation CallUser($input: CallUserInput!) {
  callUser(input: $input) {
    type          # 'offer' | 'answer' | 'ice-candidate' | 'finished' | etc.
    offer
    answer
    quality
    callId
    meetingId
    meetingLastCallTime
  }
}
```

### Call Event Types
```typescript
interface CallUserInput {
  targetUserId: string
  initiatorUserId: string
  type: 'initiate' | 'offer' | 'answer' | 'ice-candidate' | 'finished' | 
        'updateMediaState' | 'expired' | 'reconnect' | 'busy'
  offer?: string
  answer?: string
  iceCandidate?: string
  videoEnabled?: boolean
  audioEnabled?: boolean
  quality?: VideoQuality
  callId?: string
  meetingId?: string
  meetingLastCallTime?: number
}
```

### Real-Time Event Processing
**File**: `src/hooks/webrtc/WebRTCProvider.tsx`

```typescript
// Process incoming signaling events via subscription
useEffect(() => {
  if (subscriptionData?.onSubscriptionEvent?.callEvent) {
    const callEvent = subscriptionData.onSubscriptionEvent.callEvent
    
    switch (callEvent.type) {
      case 'offer':
        // Setup incoming call request
        callee.setIncomingRequest({
          offer: callEvent.offer,
          callId: callEvent.callId,
          quality: callEvent.quality,
          from: callEvent.from
        })
        setConnectionStatus('receiving-call')
        break
        
      case 'answer':
        // Process answer for ongoing call
        if (caller.peerConnection.current) {
          caller.handleAnswer(caller.peerConnection.current, callEvent.quality, 
                            JSON.parse(callEvent.answer))
        }
        break
        
      case 'ice-candidate':
        // Add ICE candidate
        const pc = caller.peerConnection.current || callee.peerConnection.current
        if (pc) {
          handleIceCandidate(pc, JSON.parse(callEvent.iceCandidate))
        }
        break
        
      case 'finished':
        // Call ended by remote user
        setConnectionStatus('finished')
        cleanup()
        break
        
      case 'updateMediaState':
        // Remote user changed video/audio state
        setRemoteVideoEnabled(callEvent.videoEnabled)
        setRemoteAudioEnabled(callEvent.audioEnabled)
        break
    }
  }
}, [subscriptionData])
```

## Quality Management

### Video Quality Configurations
**File**: `src/components/VideoQualitySelector.tsx`

```typescript
export const QUALITY_CONFIGS = {
  'ultra-low': { width: 160, height: 120, maxFramerate: 10, maxBitrate: 50000 },
  'low': { width: 320, height: 240, maxFramerate: 15, maxBitrate: 150000 },
  'medium': { width: 640, height: 480, maxFramerate: 20, maxBitrate: 500000 },
  'high': { width: 1280, height: 720, maxFramerate: 25, maxBitrate: 1500000 },
  'ultra-high': { width: 1920, height: 1080, maxFramerate: 30, maxBitrate: 3000000 }
}
```

### Adaptive Quality
```typescript
// Quality is negotiated between peers
// Each peer can request different quality from the other
const qualityWeWantFromRemote = 'high'      // What quality we want to receive
const qualityRemoteWantsFromUs = 'medium'   // What quality remote wants from us

// Applied during stream setup and dynamically when changed
applyLocalQuality(peerConnection, qualityRemoteWantsFromUs)
```

## Device Management

### Audio/Video Device Selection
**Components**: `AudioDeviceSelector.tsx`, `VideoDeviceSelector.tsx`

```typescript
// Get available devices
const devices = await navigator.mediaDevices.enumerateDevices()
const videoDevices = devices.filter(device => device.kind === 'videoinput')
const audioDevices = devices.filter(device => device.kind === 'audioinput')

// Update stream with new device
const newStream = await navigator.mediaDevices.getUserMedia({
  video: { deviceId: { exact: selectedVideoDeviceId } },
  audio: { deviceId: { exact: selectedAudioDeviceId } }
})

// Replace tracks in existing peer connection
const videoTrack = newStream.getVideoTracks()[0]
const sender = pc.getSenders().find(s => s.track?.kind === 'video')
if (sender && videoTrack) {
  await sender.replaceTrack(videoTrack)
}
```

## Connection Management

### Connection States
```typescript
type ConnectionStatus = 
  | 'disconnected'   // No active connection
  | 'calling'        // Initiating call
  | 'connecting'     // Establishing connection
  | 'connected'      // Active call
  | 'need-reconnect' // Connection lost, attempting reconnect
  | 'reconnecting'   // Reconnection in progress
  | 'failed'         // Connection failed
  | 'rejected'       // Call rejected
  | 'timeout'        // Call timed out
  | 'finished'       // Call ended normally
  | 'receiving-call' // Incoming call
  | 'busy'           // Remote user busy
```

### Automatic Reconnection
```typescript
const handleConnectionStateChange = (
  pc: RTCPeerConnection, 
  peerConnection: React.MutableRefObject<RTCPeerConnection | null>, 
  active: boolean, 
  attemptReconnect: () => Promise<void>
) => {
  if (pc.connectionState === 'connected') {
    setConnectionStatus('connected')
  } else if (pc.connectionState === 'failed') {
    pc.close()
    peerConnection.current = null
    
    if (active) {
      setConnectionStatus('reconnecting')
      attemptReconnect() // Retry connection
    } else {
      setConnectionStatus('failed')
    }
  }
}
```

### ICE Candidate Management
```typescript
// Collect and queue ICE candidates
const setupIceCandidateHandler = (pc: RTCPeerConnection, targetUserId: string) => {
  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      // Send candidate via GraphQL signaling
      await callUser({
        variables: {
          input: {
            type: 'ice-candidate',
            targetUserId,
            iceCandidate: JSON.stringify(event.candidate),
            callId
          }
        }
      })
    }
  }
}

// Handle incoming candidates (queue if remote description not set)
const handleIceCandidate = async (pc: RTCPeerConnection | null, candidate: RTCIceCandidateInit) => {
  if (pc?.remoteDescription) {
    await pc.addIceCandidate(candidate)
  } else {
    pendingIceCandidates.current.push(candidate) // Queue for later
  }
}
```

## UI Components

### Call Dialogs
**CallerDialog**: Shows outgoing call interface with hang up option
**CalleeDialog**: Shows incoming call interface with accept/reject options

```typescript
// CallerDialog shows connection status and controls
<Dialog open={connectionStatus === 'calling' || connectionStatus === 'connecting'}>
  <DialogTitle>Calling {targetUser?.name}...</DialogTitle>
  <DialogContent>
    <ConnectionStatusIndicator status={connectionStatus} />
    <LocalVideo stream={localStream} />
  </DialogContent>
  <DialogActions>
    <Button onClick={hangup}>Hang Up</Button>
  </DialogActions>
</Dialog>

// CalleeDialog shows incoming call with user info
<Dialog open={connectionStatus === 'receiving-call'}>
  <DialogTitle>Incoming call from {incomingRequest?.from.name}</DialogTitle>
  <DialogContent>
    <UserAvatar user={incomingRequest?.from} />
  </DialogContent>
  <DialogActions>
    <Button onClick={handleRejectCall}>Reject</Button>
    <Button onClick={handleAcceptCall}>Accept</Button>
  </DialogActions>
</Dialog>
```

### Video Components
```typescript
// LocalVideo - Shows user's own camera feed
<video
  ref={localVideoRef}
  autoPlay
  muted
  playsInline
  className="local-video"
/>

// RemoteVideo - Shows remote user's video feed
<video
  ref={remoteVideoRef}
  autoPlay
  playsInline
  className="remote-video"
/>
```

## Performance Optimizations

### Stream Management
- **Lazy Loading**: Camera access only when needed
- **Track Replacement**: Seamless device switching without reconnection
- **Quality Adaptation**: Dynamic bitrate adjustment based on network conditions

### Connection Optimization
- **ICE Candidate Queuing**: Efficient candidate handling
- **Transceiver Management**: Proper media direction handling
- **Connection Pooling**: Reuse connections where possible

### Error Recovery
- **Automatic Reconnection**: Seamless reconnection on connection failure
- **Graceful Degradation**: Continue with audio if video fails
- **Timeout Handling**: Prevent hanging connections

## Security Considerations

### Media Permissions
- Request permissions only when needed
- Handle permission denials gracefully
- Provide clear feedback to users

### Connection Security
- Use STUN servers for NAT traversal
- All signaling over HTTPS/WSS
- No media data stored on server (P2P only)

### Privacy Protection
- Local media stream control
- Clear connection state indication
- Explicit consent for call acceptance

This WebRTC implementation provides a robust, scalable solution for real-time video communication with high-quality media handling and seamless user experience.