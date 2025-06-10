'use client'
import React, { createContext, useContext, ReactNode, useEffect, useCallback } from 'react'
import { gql, useQuery, useMutation } from '@apollo/client'
import { useSubscriptions } from './SubscriptionsContext'
import { useStore } from '@/store/useStore'
import { usePlaySound } from '@/hooks/usePlaySound'
import { useTranslations } from 'next-intl'
import { getNotificationMessage } from '@/utils/notificationUtils'
import { useRouter } from 'next/navigation'
import { useClientPushNotifications } from '@/hooks/useClientPushNotifications'

const GET_NOTIFICATIONS = gql`
  query GetNotifications($userId: ID!) {
    getNotifications(userId: $userId) {
      _id
      type
      seen
      meetingId
      createdAt
      peerUserName
      meeting {
        _id
        userId
        languages
        interests
        timeSlots
        minDurationM
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

const MARK_ALL_NOTIFICATIONS_SEEN = gql`
  mutation MarkAllNotificationsSeen($userId: ID!) {
    setAllNotificationsSeen(userId: $userId)
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
  setAllNotificationsSeen: () => void
  markingAllSeen: boolean
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

function notificationPermissionGranted() {
  return typeof window !== 'undefined' && window.Notification && window.Notification.permission === 'granted'
}

function showBrowserNotification(notificationEvent: any, t: any, router: any) {
  if (!notificationPermissionGranted()) return

  const body = getNotificationMessage(notificationEvent, t)
  const notification = new window.Notification('Commiracle', { body })
  notification.onclick = () => {
    if (notificationEvent.meeting?._id) {
      router.push(`/list?meetingId=${notificationEvent.meeting._id}`)
    }
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useStore((state: any) => ({ currentUser: state.currentUser }))
  const { subscribeToNotifications } = useSubscriptions()
  const t = useTranslations()
  const router = useRouter()
  
  useClientPushNotifications(currentUser)

  const { data, loading, error, refetch } = useQuery(GET_NOTIFICATIONS, {
    variables: { userId: currentUser?._id },
    skip: !currentUser?._id
  })

  const notifications = data?.getNotifications || []
  
  const [markAsSeen] = useMutation(SET_NOTIFICATION_SEEN)
  const [markAllAsSeen, { loading: markingAllSeen }] = useMutation(MARK_ALL_NOTIFICATIONS_SEEN, {
    onCompleted: () => {
      refetch()
    }
  })
  
  // Update to use isPlaying from the hook
  const { play: playNotificationSound, isPlaying } = usePlaySound('/sounds/notification.mp3')
  
  // Update the subscription effect to use isPlaying
  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notificationEvent: any) => {
      if (notificationEvent) {
        showBrowserNotification(notificationEvent, t, router)
        // Play notification sound if not already playing
        if (!isPlaying) {
          playNotificationSound()
        }
        
        refetch()
      }
    })
    
    return unsubscribe
  }, [subscribeToNotifications, refetch, playNotificationSound, isPlaying, t, router])
  
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
  
  const setAllNotificationsSeen = useCallback(() => {
    if (currentUser?._id) {
      markAllAsSeen({ 
        variables: { userId: currentUser._id }
      })
    }
  }, [currentUser, markAllAsSeen])
  
  const value = {
    notifications: notifications || [],
    loading,
    error,
    refetch,
    setNotificationSeen,
    hasUnseenNotifications: notifications?.some((n: any) => !n.seen) || false,
    setAllNotificationsSeen,
    markingAllSeen
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