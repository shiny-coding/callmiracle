'use client'

import { createContext, useContext, ReactNode, useState } from 'react'
import { User } from '@/generated/graphql'

interface DetailedCallHistoryContextType {
  selectedUser: User | null
  setSelectedUser: (user: User | null) => void
}

const DetailedCallHistoryContext = createContext<DetailedCallHistoryContextType | null>(null)

export function useDetailedCallHistory() {
  const context = useContext(DetailedCallHistoryContext)
  if (!context) {
    throw new Error('useDetailedCallHistory must be used within a DetailedCallHistoryProvider')
  }
  return context
}

interface DetailedCallHistoryProviderProps {
  children: ReactNode
}

export function DetailedCallHistoryProvider({ children }: DetailedCallHistoryProviderProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  return (
    <DetailedCallHistoryContext.Provider value={{ selectedUser, setSelectedUser }}>
      {children}
    </DetailedCallHistoryContext.Provider>
  )
} 