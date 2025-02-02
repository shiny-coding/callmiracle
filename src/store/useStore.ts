import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Status } from '@/generated/graphql'
import { getBrowserLanguage } from '@/utils/language'

interface AppState {
  name: string
  languages: string[]
  statuses: Status[]
  setName: (name: string) => void
  setLanguages: (languages: string[] | ((prev: string[]) => string[])) => void
  setStatuses: (statuses: Status[]) => void
  initBrowserLangs: () => void
  targetUserId: string | null
  setTargetUserId: (userId: string | null) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      name: '',
      languages: [],
      statuses: [],
      setName: (name) => set({ name }),
      setLanguages: (languages) => 
        set({ languages: typeof languages === 'function' ? languages(get().languages) : languages }),
      setStatuses: (statuses) => set({ statuses }),
      initBrowserLangs: () => {
        const { languages } = get()
        if (languages.length === 0) {
          const browserLangs = getBrowserLanguage()
          set({ languages: browserLangs })
        }
      },
      targetUserId: null,
      setTargetUserId: (userId) => set({ targetUserId: userId })
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        name: state.name,
        languages: state.languages,
        statuses: state.statuses
      })
    }
  )
) 