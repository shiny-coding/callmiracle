import React, { createContext, useContext, useState, ReactNode } from 'react'


interface MeetingsContextType {
  highlightedMeetingId: string | null
  setHighlightedMeetingId: (meetingId: string | null) => void
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined)

interface MeetingsProviderProps {
  children: ReactNode
}

export function MeetingsProvider({ children }: MeetingsProviderProps) {
  const [highlightedMeetingId, setHighlightedMeetingId] = useState<string | null>(null)

  return (
    <MeetingsContext.Provider
      value={{
        highlightedMeetingId,
        setHighlightedMeetingId
      }}
    >
      {children}
    </MeetingsContext.Provider>
  )
}

export function useMeetings() {
  const context = useContext(MeetingsContext)
  if (context === undefined) {
    throw new Error('useMeetings must be used within a MeetingsProvider')
  }
  return context
} 