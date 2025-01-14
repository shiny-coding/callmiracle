export class WebRTCConnection {
  private peerConnection: RTCPeerConnection;
  private signalingSocket: WebSocket;
  private targetUserId: string;

  constructor(config: { 
    wsUrl: string, 
    targetUserId: string,
    onRemoteStream: (stream: MediaStream) => void 
  }) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    this.signalingSocket = new WebSocket(config.wsUrl);
    this.targetUserId = config.targetUserId;
    
    this.peerConnection.ontrack = (event) => {
      config.onRemoteStream(event.streams[0]);
    };
  }

  async initializeCall(localStream: MediaStream) {
    try {
      // 1. Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // 2. Add tracks to peer connection
      stream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, stream);
      });

      // 3. Create and send offer (if initiator)
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.signalingSocket.send(JSON.stringify({
        type: 'offer',
        payload: offer,
        to: this.targetUserId
      }));

    } catch (error) {
      console.error('Failed to initialize call:', error);
    }
  }

  public disconnect() {
    this.peerConnection.close();
    this.signalingSocket.close();
  }
} 