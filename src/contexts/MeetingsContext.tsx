import { MeetingWithPeer, Meeting, NotificationEvent, BroadcastEvent } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { ApolloError, gql, useQuery } from '@apollo/client'
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react'
import { useSubscriptions } from './SubscriptionsContext'

export const GET_MEETINGS_WITH_PEERS = gql`
  query GetMyMeetingsWithPeers($userId: ID!) {
    getMyMeetingsWithPeers(userId: $userId) {
      meeting {
        _id
        userId
        languages
        interests
        timeSlots
        minDurationM
        preferEarlier
        allowedMales
        allowedFemales
        allowedMinAge
        allowedMaxAge
        startTime
        peerMeetingId
        lastCallTime
        status
        totalDurationS
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

export const GET_FUTURE_MEETINGS_WITH_PEERS = gql`
  query GetFutureMeetingsWithPeers($userId: ID!) {
    getFutureMeetingsWithPeers(userId: $userId) {
      meeting {
        _id
        timeSlots
        interests
        languages
        minDurationM
        userId
      }
      peerUser {
        sex
      }
    }
  }
`

interface MeetingsContextType {
  highlightedMeetingId: string | null
  setHighlightedMeetingId: (meetingId: string | null) => void
  myMeetingsWithPeers: MeetingWithPeer[]
  loadingMyMeetingsWithPeers: boolean
  errorMyMeetingsWithPeers: ApolloError | undefined
  refetchMyMeetingsWithPeers: () => void
  futureMeetingsWithPeers: MeetingWithPeer[]
  loadingFutureMeetingsWithPeers: boolean
  errorFutureMeetingsWithPeers: ApolloError | undefined
  refetchFutureMeetingsWithPeers: () => void
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined)

interface MeetingsProviderProps {
  children: ReactNode
}

export function MeetingsProvider({ children }: MeetingsProviderProps) {
  const [highlightedMeetingId, setHighlightedMeetingId] = useState<string | null>(null)
  const { currentUser } = useStore()
  const { subscribeToNotifications, subscribeToBroadcastEvents } = useSubscriptions()
  const {
    data: myMeetingsWithPeersData,
    loading: loadingMyMeetingsWithPeers,
    error: errorMyMeetingsWithPeers,
    refetch: refetchMyMeetingsWithPeers }
    = useQuery(GET_MEETINGS_WITH_PEERS, {
      variables: { userId: currentUser?._id }
    })

  const myMeetingsWithPeers = useMemo(() => myMeetingsWithPeersData?.getMyMeetingsWithPeers || [], [myMeetingsWithPeersData])

  const {
    data: futureMeetingsData,
    loading: loadingFutureMeetingsWithPeers,
    error: errorFutureMeetingsWithPeers,
    refetch: refetchFutureMeetingsWithPeers
  } = useQuery(GET_FUTURE_MEETINGS_WITH_PEERS, {
    variables: { userId: currentUser?._id },
    skip: !currentUser?._id
  })
  const futureMeetingsWithPeers = useMemo(() => futureMeetingsData?.getFutureMeetingsWithPeers || [], [futureMeetingsData])

  const refetchMeetings = useCallback(async () => {
    await refetchMyMeetingsWithPeers();
    await refetchFutureMeetingsWithPeers();
  }, [refetchMyMeetingsWithPeers, refetchFutureMeetingsWithPeers])

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((event: NotificationEvent) => {
      if (event.type.startsWith('MEETING_')) {
        refetchMeetings();
      }
    })
    
    return unsubscribe
  }, [subscribeToNotifications, refetchMeetings])

  useEffect(() => {
    const unsubscribe = subscribeToBroadcastEvents((event: BroadcastEvent) => {
      refetchMeetings();
    })
    
    return unsubscribe
  }, [subscribeToBroadcastEvents, refetchMeetings])
  
  return (
    <MeetingsContext.Provider
      value={{
        highlightedMeetingId,
        setHighlightedMeetingId,
        myMeetingsWithPeers,
        loadingMyMeetingsWithPeers,
        errorMyMeetingsWithPeers,
        refetchMyMeetingsWithPeers,
        futureMeetingsWithPeers,
        loadingFutureMeetingsWithPeers,
        errorFutureMeetingsWithPeers,
        refetchFutureMeetingsWithPeers
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