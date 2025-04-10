import { MeetingWithPeer } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { ApolloError, gql, useQuery } from '@apollo/client'
import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react'

export const GET_MEETINGS = gql`
  query GetMeetings($userId: ID!) {
    getMeetings(userId: $userId) {
      meeting {
        _id
        userId
        languages
        statuses
        timeSlots
        minDuration
        preferEarlier
        allowedMales
        allowedFemales
        allowedMinAge
        allowedMaxAge
        startTime
        peerMeetingId
        lastCallTime
        status
        totalDuration
      }
      peerMeeting {
        _id
        userId
        languages
        statuses
      }
      peerUser {
        _id
        name
        sex
        languages
      }
    }
  }
` 

interface MeetingsContextType {
  highlightedMeetingId: string | null
  setHighlightedMeetingId: (meetingId: string | null) => void
  meetings: MeetingWithPeer[]
  loading: boolean
  error: ApolloError | undefined
  refetch: () => void
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined)

interface MeetingsProviderProps {
  children: ReactNode
}

export function MeetingsProvider({ children }: MeetingsProviderProps) {
  const [highlightedMeetingId, setHighlightedMeetingId] = useState<string | null>(null)
  const { currentUser } = useStore()
  const { data, loading, error, refetch } = useQuery(GET_MEETINGS, {
    variables: { userId: currentUser?._id }
  })
  const meetings = useMemo(() => data?.getMeetings || [], [data])

  return (
    <MeetingsContext.Provider
      value={{
        highlightedMeetingId,
        setHighlightedMeetingId,
        meetings,
        loading,
        error,
        refetch
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