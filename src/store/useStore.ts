import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Status } from '@/generated/graphql'
import { getBrowserLanguage } from '@/utils/language'

interface AppState {
  name: string
  languages: string[]
  statuses: Status[]
  hasImage: boolean
  // Call state
  callId: string | null
  connectionStatus: 'disconnected' | 'calling' | 'connecting' | 'connected' | 'failed' | 'rejected' | 'timeout' | 'finished' | 'expired' | null
  targetUserId: string | null
  role: 'caller' | 'callee' | null
  setName: (name: string) => void
  setLanguages: (languages: string[] | ((prev: string[]) => string[])) => void
  setStatuses: (statuses: Status[]) => void
  setHasImage: (hasImage: boolean) => void
  // Call state setters
  setCallState: (state: { 
    callId: string | null
    connectionStatus: AppState['connectionStatus']
    targetUserId: string | null
    role: AppState['role']
  }) => void
  clearCallState: () => void
}

// Split into two parts: persisted and non-persisted
const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Non-persisted state (initialized from server)
      name: '',
      languages: [],
      statuses: [],
      hasImage: false,
      // Call state (persisted)
      callId: null,
      connectionStatus: null,
      targetUserId: null,
      role: null,
      setName: (name) => set({ name }),
      setLanguages: (languages) => 
        set({ languages: typeof languages === 'function' ? languages(get().languages) : languages }),
      setStatuses: (statuses) => set({ statuses }),
      setHasImage: (hasImage) => set({ hasImage }),
      setCallState: (state) => set(state),
      clearCallState: () => set({ 
        callId: null, 
        connectionStatus: null, 
        targetUserId: null,
        role: null 
      })
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        callId: state.callId,
        connectionStatus: state.connectionStatus,
        targetUserId: state.targetUserId,
        role: state.role
      })
    }
  )
)

export { useStore } 