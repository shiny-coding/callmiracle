'use client'
import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import { gql, useQuery, useMutation } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { useSubscriptions } from './SubscriptionsContext'

const GET_NOTIFICATIONS = gql`
  query GetNotifications($userId: ID!) {
    notifications(userId: $userId) {
      _id
      type
      seen
      meetingId
      createdAt
      meeting {
        _id
        userId
        languages
        statuses
        timeSlots
        minDuration
        startTime
        peerMeetingId
        status
      }
    }
  }
`

const SET_NOTIFICATION_SEEN = gql`
  mutation SetNotificationSeen($id: ID!) {
    setNotificationSeen(id: $id) {
      _id
      seen
    }
  }
`

type NotificationType = {
  _id: string
  type: string
  seen: boolean
  meetingId?: string
  createdAt: number
  meeting?: any
}

interface NotificationsContextType {
  notifications: NotificationType[]
  loading: boolean
  error: any
  refetch: () => void
  setNotificationSeen: (id: string) => Promise<void>
  hasUnseenNotifications: boolean
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const userId = getUserId()
  const { subscribeToNotifications } = useSubscriptions()
  
  const { data, loading, error, refetch } = useQuery(GET_NOTIFICATIONS, {
    variables: { userId },
    skip: !userId
  })
  
  const [markAsSeen] = useMutation(SET_NOTIFICATION_SEEN)
  
  // Subscribe to notifications through the SubscriptionsProvider
  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notificationEvent) => {
      if (notificationEvent) {
        refetch()
      }
    })
    
    return unsubscribe
  }, [subscribeToNotifications, refetch])
  
  const setNotificationSeen = async (id: string) => {
    try {
      await markAsSeen({
        variables: { id },
        update: (cache, { data }) => {
          // Update the cache to mark this notification as seen
          if (data?.setNotificationSeen) {
            cache.modify({
              id: cache.identify(data.setNotificationSeen),
              fields: {
                seen: () => true
              }
            })
          }
        }
      })
    } catch (error) {
      console.error('Error marking notification as seen:', error)
    }
  }
  
  const value = {
    notifications: data?.notifications || [],
    loading,
    error,
    refetch,
    setNotificationSeen,
    hasUnseenNotifications: data?.notifications?.some((n: any) => !n.seen) || false
  }
  
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
} 