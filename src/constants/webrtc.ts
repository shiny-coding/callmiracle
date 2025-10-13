// WebRTC configuration constants

export const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
]

export const ICE_SERVERS = STUN_SERVERS.map(url => ({ urls: url }))
