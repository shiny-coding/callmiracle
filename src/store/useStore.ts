import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Status } from '@/generated/graphql'
import { getBrowserLanguage } from '@/utils/language'

interface AppState {
  name: string
  selectedLangs: string[]
  selectedStatuses: Status[]
  setName: (name: string) => void
  setSelectedLangs: (langs: string[] | ((prev: string[]) => string[])) => void
  setSelectedStatuses: (statuses: Status[]) => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      name: '',
      selectedLangs: getBrowserLanguage(),
      selectedStatuses: [],
      setName: (name) => set({ name }),
      setSelectedLangs: (selectedLangs) => 
        set({ selectedLangs: typeof selectedLangs === 'function' ? selectedLangs(get().selectedLangs) : selectedLangs }),
      setSelectedStatuses: (selectedStatuses) => set({ selectedStatuses })
    }),
    {
      name: 'app-storage',
      skipHydration: true
    }
  )
) 