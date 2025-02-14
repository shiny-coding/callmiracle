import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Status } from '@/generated/graphql'
import { getBrowserLanguage } from '@/utils/language'

interface AppState {
  name: string
  languages: string[]
  statuses: Status[]
  hasImage: boolean
  setName: (name: string) => void
  setLanguages: (languages: string[] | ((prev: string[]) => string[])) => void
  setStatuses: (statuses: Status[]) => void
  setHasImage: (hasImage: boolean) => void
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
      setName: (name) => set({ name }),
      setLanguages: (languages) => 
        set({ languages: typeof languages === 'function' ? languages(get().languages) : languages }),
      setStatuses: (statuses) => set({ statuses }),
      setHasImage: (hasImage) => set({ hasImage })
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: () => ({})
    }
  )
)

export { useStore } 