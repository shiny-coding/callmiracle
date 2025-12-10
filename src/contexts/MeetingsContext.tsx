import { MeetingWithPeer, Meeting, NotificationEvent, BroadcastEvent } from '@/generated/graphql'
import { useStore } from '@/store/useStore'
import { ApolloError, gql, useQuery, NetworkStatus } from '@apollo/client'
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSubscriptions } from './SubscriptionsContext'
import { shallow } from 'zustand/shallow'
import { refetchConfig } from '@/config'

export const GET_MEETINGS_WITH_PEERS = gql`
  query GetMyMeetingsWithPeers($userId: ID!) {
    getMyMeetingsWithPeers(userId: $userId) {
      meeting {
        _id
        userId
        groupId
        userName
        language
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
        transparency
      }
      peerMeeting {
        _id
        userId
        groupId
        language
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
        language
        minDurationM
        userId
        groupId
        userName
        transparency
        createdAt
        startTime
        lastCallTime
        status
      }
      peerUser {
        sex
        name
      }
      filteredOut
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
  refetchMyMeetingsWithPeers: (userInitiated?: boolean) => void
  futureMeetingsWithPeers: MeetingWithPeer[]
  loadingFutureMeetingsWithPeers: boolean
  errorFutureMeetingsWithPeers: ApolloError | undefined
  networkStatusFutureMeetings?: NetworkStatus
  refetchFutureMeetingsWithPeers: (variables?: any, userInitiated?: boolean) => void
  refetchMeetings: (userInitiated?: boolean) => void
  // Track if current loading is user-initiated (for showing loading screen)
  isUserInitiatedLoading: boolean
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined)

interface MeetingsProviderProps {
  children: ReactNode
}

export function MeetingsProvider({ children }: MeetingsProviderProps) {
  const [highlightedMeetingId, setHighlightedMeetingId] = useState<string | null>(null)
  const [isUserInitiatedLoading, setIsUserInitiatedLoading] = useState(false)
  const scheduledRefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    refetch: refetchMyMeetingsWithPeersQuery,
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

  // Clear user-initiated loading when operations complete
  useEffect(() => {
    if (isUserInitiatedLoading && !loadingMyMeetingsWithPeers && !loadingFutureMeetingsWithPeers) {
      setIsUserInitiatedLoading(false)
    }
  }, [loadingMyMeetingsWithPeers, loadingFutureMeetingsWithPeers, isUserInitiatedLoading])

  const refetchMyMeetingsWithPeers = useCallback((userInitiated = false) => {
    if (userInitiated) {
      setIsUserInitiatedLoading(true)
    }
    refetchMyMeetingsWithPeersQuery()
  }, [refetchMyMeetingsWithPeersQuery])

  const refetchFutureMeetings = useCallback((variables?: any, userInitiated = false) => {
    if (userInitiated) {
      setIsUserInitiatedLoading(true)
    }
    refetchFutureMeetingsWithPeersQuery(variables)
  }, [refetchFutureMeetingsWithPeersQuery])

  const refetchMeetings = useCallback(async (userInitiated = false) => {
    if (userInitiated) {
      setIsUserInitiatedLoading(true)
    }
    await refetchMyMeetingsWithPeersQuery();
    await refetchFutureMeetingsWithPeersQuery();
  }, [refetchMyMeetingsWithPeersQuery, refetchFutureMeetingsWithPeersQuery])

  /**
   * Schedule a refetch with random delay to scatter load across clients
   * This is used for broadcast events where we want to avoid thundering herd
   */
  const scheduleScatteredRefetch = useCallback(() => {
    // Clear any existing scheduled refetch
    if (scheduledRefetchTimeoutRef.current) {
      clearTimeout(scheduledRefetchTimeoutRef.current)
    }

    // Calculate random delay between min and max
    const { minDelayMs, maxDelayMs } = refetchConfig
    const delay = Math.random() * (maxDelayMs - minDelayMs) + minDelayMs

    scheduledRefetchTimeoutRef.current = setTimeout(() => {
      refetchMeetings(false)
      scheduledRefetchTimeoutRef.current = null
    }, delay)
  }, [refetchMeetings])

  // Cleanup scheduled refetch on unmount
  useEffect(() => {
    return () => {
      if (scheduledRefetchTimeoutRef.current) {
        clearTimeout(scheduledRefetchTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((event: NotificationEvent) => {
      if (event.type.startsWith('MEETING_')) {
        console.log('Refetching meetings immediately because of meeting notification (user-specific event)')
        // User-specific notifications refetch immediately (e.g., meeting connected/disconnected)
        refetchMeetings(false);
      }
    })

    return unsubscribe
  }, [subscribeToNotifications, refetchMeetings])

  useEffect(() => {
    const unsubscribe = subscribeToBroadcastEvents((event: BroadcastEvent) => {
      console.log('Received broadcast event, scheduling scattered refetch')
      // Broadcast events use scattered refetch to avoid thundering herd
      scheduleScatteredRefetch();
    })

    return unsubscribe
  }, [subscribeToBroadcastEvents, scheduleScatteredRefetch])
  
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
        refetchMeetings,
        isUserInitiatedLoading
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