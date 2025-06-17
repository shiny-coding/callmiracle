import { MeetingWithPeer, Meeting, NotificationEvent, BroadcastEvent } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { ApolloError, gql, useQuery, NetworkStatus } from '@apollo/client'
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react'
import { useSubscriptions } from './SubscriptionsContext'
import { shallow } from 'zustand/shallow'

export const GET_MEETINGS_WITH_PEERS = gql`
  query GetMyMeetingsWithPeers($userId: ID!) {
    getMyMeetingsWithPeers(userId: $userId) {
      meeting {
        _id
        userId
        groupId
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
        groupId
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
  query GetFutureMeetingsWithPeers(
    $userId: ID!
    $filterInterests: [String!]
    $filterLanguages: [String!]
    $filterAllowedMales: Boolean
    $filterAllowedFemales: Boolean
    $filterMinAge: Int
    $filterMaxAge: Int
    $filterMinDurationM: Int
    $filterGroups: [String!]
  ) {
    getFutureMeetingsWithPeers(
      userId: $userId
      filterInterests: $filterInterests
      filterLanguages: $filterLanguages
      filterAllowedMales: $filterAllowedMales
      filterAllowedFemales: $filterAllowedFemales
      filterMinAge: $filterMinAge
      filterMaxAge: $filterMaxAge
      filterMinDurationM: $filterMinDurationM
      filterGroups: $filterGroups
    ) {
      meeting {
        _id
        timeSlots
        interests
        languages
        minDurationM
        userId
        groupId
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
  networkStatusMyMeetings?: NetworkStatus
  refetchMyMeetingsWithPeers: () => void
  futureMeetingsWithPeers: MeetingWithPeer[]
  loadingFutureMeetingsWithPeers: boolean
  errorFutureMeetingsWithPeers: ApolloError | undefined
  networkStatusFutureMeetings?: NetworkStatus
  refetchFutureMeetingsWithPeers: (variables?: any) => void
  refetchMeetings: () => void
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined)

interface MeetingsProviderProps {
  children: ReactNode
}

export function MeetingsProvider({ children }: MeetingsProviderProps) {
  const [highlightedMeetingId, setHighlightedMeetingId] = useState<string | null>(null)
  const { 
    currentUser,
    filterInterests,
    filterLanguages,
    filterAllowedMales,
    filterAllowedFemales,
    filterAgeRange,
    filterMinDurationM,
    filterGroups,
    // initializeFilters
  } = useStore(state => ({
    currentUser: state.currentUser,
    filterInterests: state.filterInterests,
    filterLanguages: state.filterLanguages,
    filterAllowedMales: state.filterAllowedMales,
    filterAllowedFemales: state.filterAllowedFemales,
    filterAgeRange: state.filterAgeRange,
    filterMinDurationM: state.filterMinDurationM,
    filterGroups: state.filterGroups,
    // initializeFilters: state.initializeFilters,
  }), shallow)
  const { subscribeToNotifications, subscribeToBroadcastEvents } = useSubscriptions()

  // useEffect(() => {
  //   if (currentUser) {
  //     initializeFilters(currentUser.languages || [])
  //   }
  // }, [currentUser, initializeFilters])

  const {
    data: myMeetingsWithPeersData,
    loading: loadingMyMeetingsWithPeers,
    error: errorMyMeetingsWithPeers,
    refetch: refetchMyMeetingsWithPeers,
    networkStatus: networkStatusMyMeetings
  } = useQuery(GET_MEETINGS_WITH_PEERS, {
    variables: { userId: currentUser?._id },
    notifyOnNetworkStatusChange: true,
  })

  const myMeetingsWithPeers = useMemo(() => myMeetingsWithPeersData?.getMyMeetingsWithPeers || [], [myMeetingsWithPeersData])

  const {
    data: futureMeetingsData,
    loading: loadingFutureMeetingsWithPeers,
    error: errorFutureMeetingsWithPeers,
    refetch: refetchFutureMeetingsWithPeersQuery,
    networkStatus: networkStatusFutureMeetings
  } = useQuery(GET_FUTURE_MEETINGS_WITH_PEERS, {
    variables: {
      userId: currentUser?._id,
      filterInterests: filterInterests,
      filterLanguages: filterLanguages,
      filterAllowedMales: filterAllowedMales,
      filterAllowedFemales: filterAllowedFemales,
      filterMinAge: filterAgeRange[0],
      filterMaxAge: filterAgeRange[1],
      filterMinDurationM: filterMinDurationM,
      filterGroups: filterGroups,
    },
    skip: !currentUser?._id,
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  })
  const futureMeetingsWithPeers = useMemo(() => futureMeetingsData?.getFutureMeetingsWithPeers || [], [futureMeetingsData])

  const refetchFutureMeetings = useCallback((variables?: any) => {
    refetchFutureMeetingsWithPeersQuery(variables)
  }, [refetchFutureMeetingsWithPeersQuery])

  const refetchMeetings = useCallback(async () => {
    await refetchMyMeetingsWithPeers();
    await refetchFutureMeetingsWithPeersQuery();
  }, [refetchMyMeetingsWithPeers, refetchFutureMeetingsWithPeersQuery])

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((event: NotificationEvent) => {
      if (event.type.startsWith('MEETING_')) {
        console.log('Refetching meetings because of meeting notification')
        refetchMeetings();
      }
    })
    
    return unsubscribe
  }, [subscribeToNotifications, refetchMeetings])

  useEffect(() => {
    const unsubscribe = subscribeToBroadcastEvents((event: BroadcastEvent) => {
      // refetchMeetings();
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
        networkStatusMyMeetings,
        refetchMyMeetingsWithPeers,
        futureMeetingsWithPeers,
        loadingFutureMeetingsWithPeers,
        errorFutureMeetingsWithPeers,
        networkStatusFutureMeetings,
        refetchFutureMeetingsWithPeers: refetchFutureMeetings,
        refetchMeetings
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