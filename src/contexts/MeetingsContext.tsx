import { MeetingWithPeer, Meeting } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { ApolloError, gql, useQuery } from '@apollo/client'
import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react'

export const GET_MEETINGS_WITH_PEERS = gql`
  query GetMeetingsWithPeers($userId: ID!) {
    getMeetingsWithPeers(userId: $userId) {
      meeting {
        _id
        userId
        languages
        interests
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
        interests
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

export const GET_FUTURE_MEETINGS = gql`
  query GetFutureMeetings($userId: ID!) {
    getFutureMeetings(userId: $userId) {
      _id
      timeSlots
      interests
      languages
      minDuration
      userId
    }
  }
`

interface MeetingsContextType {
  highlightedMeetingId: string | null
  setHighlightedMeetingId: (meetingId: string | null) => void
  meetingsWithPeers: MeetingWithPeer[]
  loadingMeetingsWithPeers: boolean
  errorMeetingsWithPeers: ApolloError | undefined
  refetchMeetingsWithPeers: () => void
  futureMeetings: Meeting[]
  loadingFutureMeetings: boolean
  errorFutureMeetings: ApolloError | undefined
  refetchFutureMeetings: () => void
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined)

interface MeetingsProviderProps {
  children: ReactNode
}

export function MeetingsProvider({ children }: MeetingsProviderProps) {
  const [highlightedMeetingId, setHighlightedMeetingId] = useState<string | null>(null)
  const { currentUser } = useStore()
  const { data: meetingsWithPeersData, loading: loadingMeetingsWithPeers, error: errorMeetingsWithPeers, refetch: refetchMeetingsWithPeers } = useQuery(GET_MEETINGS_WITH_PEERS, {
    variables: { userId: currentUser?._id }
  })
  const meetingsWithPeers = useMemo(() => meetingsWithPeersData?.getMeetingsWithPeers || [], [meetingsWithPeersData])

  const {
    data: futureMeetingsData,
    loading: loadingFutureMeetings,
    error: errorFutureMeetings,
    refetch: refetchFutureMeetings
  } = useQuery(GET_FUTURE_MEETINGS, {
    variables: { userId: currentUser?._id },
    skip: !currentUser?._id
  })
  const futureMeetings = useMemo(() => futureMeetingsData?.getFutureMeetings || [], [futureMeetingsData])

  return (
    <MeetingsContext.Provider
      value={{
        highlightedMeetingId,
        setHighlightedMeetingId,
        meetingsWithPeers,
        loadingMeetingsWithPeers,
        errorMeetingsWithPeers,
        refetchMeetingsWithPeers,
        futureMeetings,
        loadingFutureMeetings,
        errorFutureMeetings,
        refetchFutureMeetings
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