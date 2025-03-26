import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Status, User } from '@/generated/graphql'
import { type VideoQuality } from '@/components/VideoQualitySelector'
import { ConnectionStatus } from '@/hooks/webrtc/useWebRTCCommon'

interface AppState {
  currentUser: User | null // non-persisted
  currentUserId: string | null // persisted
  // Call state
  callId: string | null
  meetingId: string | null
  connectionStatus: ConnectionStatus
  targetUser: User | null
  role: 'caller' | 'callee' | null
  lastConnectedTime: number | null
  meetingLastCallTime: number | null
  // Media settings
  localAudioEnabled: boolean
  localVideoEnabled: boolean
  qualityWeWantFromRemote: VideoQuality
  qualityRemoteWantsFromUs: VideoQuality
  setCurrentUser: (currentUser: User | null) => void
  setCurrentUserId: (currentUserId: string | null) => void
  // Call state setters
  setCallId: (callId: string | null) => void
  setConnectionStatus: (status: AppState['connectionStatus']) => void
  setTargetUser: (user: User | null) => void
  setRole: (role: AppState['role']) => void
  setLastConnectedTime: (time: number | null) => void
  clearCallState: () => void
  // Media settings setters
  setLocalAudioEnabled: (enabled: boolean) => void
  setLocalVideoEnabled: (enabled: boolean) => void
  setQualityWeWantFromRemote: (quality: VideoQuality) => void
  setQualityRemoteWantsFromUs: (quality: VideoQuality) => void
  setMeetingId: (id: string | null) => void
  setMeetingLastCallTime: (time: number | null) => void
}

const TWO_MINUTES = 2 * 60 * 1000 // 2 minutes in milliseconds

let rehydrated = false

// Split into two parts: persisted and non-persisted
const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Non-persisted state (initialized from server)
      currentUser: null,
      // Persisted state  
      currentUserId: null,
      callId: null,
      connectionStatus: 'disconnected',
      targetUser: null,
      role: null,
      lastConnectedTime: null,
      meetingId: null,
      meetingLastCallTime: null,
      // Media settings (persisted)
      localAudioEnabled: true,
      localVideoEnabled: true,
      qualityWeWantFromRemote: '720p',
      qualityRemoteWantsFromUs: '720p',
      setCurrentUser: (currentUser) => set({ currentUser }),
      setCurrentUserId: (currentUserId: string | null) => set({ currentUserId }),
      setCallId: (callId) => { 
        set({ callId })
      },
      setConnectionStatus: (connectionStatus) => {
        set({ connectionStatus })
        // Update lastConnectedTime when status changes to connected
        if (connectionStatus === 'connected') {
          set({ lastConnectedTime: Date.now() })
        }
      },
      setTargetUser: (targetUser) => { set({ targetUser }) },
      setRole: (role) => set({ role }),
      setLastConnectedTime: (time) => set({ lastConnectedTime: time }),
      clearCallState: () => set({ 
        callId: null, 
        role: null,
        lastConnectedTime: null,
        meetingId: null,
        meetingLastCallTime: null
      }),
      // Media settings setters
      setLocalAudioEnabled: (enabled) => {
        set({ localAudioEnabled: enabled })
      },
      setLocalVideoEnabled: (enabled) => {
        set({ localVideoEnabled: enabled })
      },
      setQualityWeWantFromRemote: (quality) => {
        set({ qualityWeWantFromRemote: quality })
      },
      setQualityRemoteWantsFromUs: (quality) => {
        set({ qualityRemoteWantsFromUs: quality })
      },
      setMeetingId: (id) => set({ meetingId: id }),
      setMeetingLastCallTime: (time) => set({ meetingLastCallTime: time }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        callId: state.callId,
        connectionStatus: state.connectionStatus,
        targetUser: state.targetUser,
        role: state.role,
        lastConnectedTime: state.lastConnectedTime,
        localAudioEnabled: state.localAudioEnabled,
        localVideoEnabled: state.localVideoEnabled,
        qualityWeWantFromRemote: state.qualityWeWantFromRemote,
        qualityRemoteWantsFromUs: state.qualityRemoteWantsFromUs,
        meetingId: state.meetingId,
        meetingLastCallTime: state.meetingLastCallTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && !rehydrated) {
          rehydrated = true
          // Check if we need to handle reconnection
          if ( state.connectionStatus === 'connected' ) {
            const timeSinceLastConnection = Date.now() - (state.lastConnectedTime ?? 0)
            if (timeSinceLastConnection < TWO_MINUTES) {
              // Within 2 minutes, set to reconnecting
              state.setConnectionStatus('need-reconnect')
            } else {
              // More than 2 minutes, set to disconnected
              state.setConnectionStatus('disconnected')
              state.clearCallState()
            }
          } else {
            state.setConnectionStatus('disconnected')
            state.clearCallState()
          }
        }
      }
    }
  )
)

export { useStore } 