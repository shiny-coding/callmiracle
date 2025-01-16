import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Status } from '@/generated/graphql'
import { getBrowserLanguage } from '@/utils/language'

interface AppState {
  name: string
  selectedLangs: string[]
  selectedStatuses: Status[]
  setName: (name: string) => void
  setSelectedLangs: (langs: string[] | ((prev: string[]) => string[])) => void
  setSelectedStatuses: (statuses: Status[]) => void
  initBrowserLangs: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      name: '',
      selectedLangs: [],
      selectedStatuses: [],
      setName: (name) => set({ name }),
      setSelectedLangs: (selectedLangs) => 
        set({ selectedLangs: typeof selectedLangs === 'function' ? selectedLangs(get().selectedLangs) : selectedLangs }),
      setSelectedStatuses: (selectedStatuses) => set({ selectedStatuses }),
      initBrowserLangs: () => {
        const { selectedLangs } = get()
        if (selectedLangs.length === 0) {
          const browserLangs = getBrowserLanguage()
          set({ selectedLangs: browserLangs })
        }
      }
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true
    }
  )
) 