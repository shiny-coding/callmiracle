import { createStore } from 'zustand/vanilla'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware'
import { User } from '@/generated/graphql'
import { type VideoQuality } from '@/components/VideoQualitySelector'
import { ConnectionStatus } from '@/hooks/webrtc/useWebRTCCommon'
import { shallow } from 'zustand/shallow'

// Define default filter values
const DEFAULT_FILTER_INTERESTS: string[] = []
const DEFAULT_FILTER_LANGUAGES: string[] = [] // Will be overridden by user's languages on init
const DEFAULT_FILTER_ALLOWED_MALES = true
const DEFAULT_FILTER_ALLOWED_FEMALES = true
const DEFAULT_FILTER_AGE_RANGE: [number, number] = [10, 100]
const DEFAULT_FILTER_MIN_DURATION_M = 30

export interface AppState {
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

  // Meeting Filters (these are the applied filters)
  filterInterests: string[]
  filterLanguages: string[]
  filterAllowedMales: boolean
  filterAllowedFemales: boolean
  filterAgeRange: [number, number]
  filterMinDurationM: number
  filterGroups: string[]

  // Filter setters (directly update the applied filters)
  setFilterInterests: (interests: string[]) => void
  setFilterLanguages: (languages: string[]) => void
  setFilterAllowedMales: (allowed: boolean) => void
  setFilterAllowedFemales: (allowed: boolean) => void
  setFilterAgeRange: (range: [number, number]) => void
  setFilterMinDurationM: (duration: number) => void
  setFilterGroups: (groups: string[]) => void

  // Last meeting group for remembering user's last choice
  lastMeetingGroup: string | null
  setLastMeetingGroup: (groupId: string | null) => void
  
  // Last meeting languages for remembering user's last choice
  lastMeetingLanguage: string[] | null
  setLastMeetingLanguage: (languages: string[] | null) => void

  // Last conversation for remembering user's last viewed conversation
  lastConversationId: string | null
  setLastConversationId: (conversationId: string | null) => void
}

// Define which parts of AppState are persisted
type PersistedAppState = Pick<
  AppState,
  | 'currentUserId'
  | 'callId'
  | 'connectionStatus'
  | 'targetUser'
  | 'role'
  | 'lastConnectedTime'
  | 'localAudioEnabled'
  | 'localVideoEnabled'
  | 'qualityWeWantFromRemote'
  | 'qualityRemoteWantsFromUs'
  | 'meetingId'
  | 'meetingLastCallTime'
  | 'filterInterests'
  | 'filterLanguages'
  | 'filterAllowedMales'
  | 'filterAllowedFemales'
  | 'filterAgeRange'
  | 'filterMinDurationM'
  | 'filterGroups'
  | 'lastMeetingGroup'
  | 'lastMeetingLanguage'
  | 'lastConversationId'
>;

const TWO_MINUTES = 2 * 60 * 1000 // 2 minutes in milliseconds
let rehydrated = false

// Type for persist options
type AppPersistOptions = PersistOptions<AppState, PersistedAppState>

const storeInitializer = persist<AppState, [], [], PersistedAppState>(
    (set, get): AppState => ({
      currentUser: null,
      currentUserId: null,
      callId: null,
      connectionStatus: 'disconnected',
      targetUser: null,
      role: null,
      lastConnectedTime: null,
      meetingId: null,
      meetingLastCallTime: null,
      localAudioEnabled: true,
      localVideoEnabled: true,
      qualityWeWantFromRemote: '720p',
      qualityRemoteWantsFromUs: '720p',
      filterInterests: DEFAULT_FILTER_INTERESTS,
      filterLanguages: DEFAULT_FILTER_LANGUAGES,
      filterAllowedMales: DEFAULT_FILTER_ALLOWED_MALES,
      filterAllowedFemales: DEFAULT_FILTER_ALLOWED_FEMALES,
      filterAgeRange: DEFAULT_FILTER_AGE_RANGE,
      filterMinDurationM: DEFAULT_FILTER_MIN_DURATION_M,
      filterGroups: [],
      lastMeetingGroup: null,
      lastMeetingLanguage: null,
      lastConversationId: null,
      setCurrentUser: (currentUser) => {
        set({ currentUser })
      },
      setCurrentUserId: (currentUserId: string | null) => set({ currentUserId }),
      setCallId: (callId) => { 
        set({ callId })
      },
      setConnectionStatus: (connectionStatus) => {
        set({ connectionStatus })
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
      }),
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
      setFilterInterests: (interests) => set({ filterInterests: interests }),
      setFilterLanguages: (languages) => set({ filterLanguages: languages }),
      setFilterAllowedMales: (allowed) => set({ filterAllowedMales: allowed }),
      setFilterAllowedFemales: (allowed) => set({ filterAllowedFemales: allowed }),
      setFilterAgeRange: (range) => set({ filterAgeRange: range }),
      setFilterMinDurationM: (duration) => set({ filterMinDurationM: duration }),
      setFilterGroups: (groups) => set({ filterGroups: groups }),
      setLastMeetingGroup: (groupId) => set({ lastMeetingGroup: groupId }),
      setLastMeetingLanguage: (languages) => set({ lastMeetingLanguage: languages }),
      setLastConversationId: (conversationId) => set({ lastConversationId: conversationId }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state: AppState): PersistedAppState => ({
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
        filterInterests: state.filterInterests,
        filterLanguages: state.filterLanguages,
        filterAllowedMales: state.filterAllowedMales,
        filterAllowedFemales: state.filterAllowedFemales,
        filterAgeRange: state.filterAgeRange,
        filterMinDurationM: state.filterMinDurationM,
        filterGroups: state.filterGroups,
        lastMeetingGroup: state.lastMeetingGroup,
        lastMeetingLanguage: state.lastMeetingLanguage,
        lastConversationId: state.lastConversationId,
      }),
      onRehydrateStorage: () => (state?: AppState, error?: Error) => {
        if (state && !rehydrated) {
          rehydrated = true
          if ( state.connectionStatus === 'connected' ) {
            const timeSinceLastConnection = Date.now() - (state.lastConnectedTime ?? 0)
            if (timeSinceLastConnection < TWO_MINUTES) {
              state.setConnectionStatus('need-reconnect')
            } else {
              state.setConnectionStatus('disconnected')
              state.clearCallState()
            }
          } else {
            state.setConnectionStatus('disconnected')
            state.clearCallState()
          }
        }
      }
    } as AppPersistOptions
  );

const vanillaStore = createStore(storeInitializer);
export { vanillaStore }

export function useStore<TStateSlice>(
  selector: (state: AppState) => TStateSlice,
  equalityFn: (a: TStateSlice, b: TStateSlice) => boolean = shallow
) {
  return useStoreWithEqualityFn(vanillaStore, selector, equalityFn);
} 


export function syncStore(): AppState {
  return vanillaStore.getState()
}