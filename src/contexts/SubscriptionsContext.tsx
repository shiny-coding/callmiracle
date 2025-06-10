'use client'
import React, { createContext, useContext, ReactNode, useCallback } from 'react'
import { gql, useSubscription } from '@apollo/client'
import { useStore } from '@/store/useStore'
import { CallEvent, NotificationEvent, BroadcastEvent } from '@/generated/graphql'

const ON_SUBSCRIPTION_EVENT = gql`
  subscription OnSubscriptionEvent($userId: ID!) {
    onSubscriptionEvent(userId: $userId) {
      callEvent {
        type
        offer
        answer
        iceCandidate
        videoEnabled
        audioEnabled
        quality
        callId
        meetingId
        meetingLastCallTime
        from {
          _id
          name
          languages
        }
      }
      notificationEvent {
        type
        meeting {
          _id
          userId
        }
        user {
          _id
          name
        }
      }
      broadcastEvent {
        type
      }
    }
  }
`

interface SubscriptionsContextType {
  subscribeToNotifications: (callback: (event: NotificationEvent) => void) => void
  subscribeToCallEvents: (callback: (event: CallEvent) => void) => void
  subscribeToBroadcastEvents: (callback: (event: BroadcastEvent) => void) => void
}

const SubscriptionsContext = createContext<SubscriptionsContextType | null>(null)

export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useStore((state: any) => ({ currentUser: state.currentUser }))

  // Store callbacks in refs to avoid unnecessary re-renders
  const notificationCallbacks = React.useRef<((event: any) => void)[]>([])
  const callCallbacks = React.useRef<((event: any) => void)[]>([])
  const broadcastCallbacks = React.useRef<((event: any) => void)[]>([])
  // Register callbacks
  const subscribeToNotifications = useCallback((callback: (event: NotificationEvent) => void) => {
    notificationCallbacks.current.push(callback)
    return () => {
      notificationCallbacks.current = notificationCallbacks.current.filter(cb => cb !== callback)
    }
  }, [])

  const subscribeToCallEvents = useCallback((callback: (event: CallEvent) => void) => {
    callCallbacks.current.push(callback)
    return () => {
      callCallbacks.current = callCallbacks.current.filter(cb => cb !== callback)
    }
  }, [])

  const subscribeToBroadcastEvents = useCallback((callback: (event: BroadcastEvent) => void) => {
    broadcastCallbacks.current.push(callback)
    return () => {
      broadcastCallbacks.current = broadcastCallbacks.current.filter(cb => cb !== callback)
    }
  }, [])

  // Central subscription that distributes events to all registered callbacks
  useSubscription(ON_SUBSCRIPTION_EVENT, {
    variables: { userId: currentUser?._id || '' },
    skip: !currentUser?._id,
    onData: ({ data: subscriptionData }) => {
      const data = subscriptionData.data?.onSubscriptionEvent
      
      if (!data) return
      
      // Handle notification events
      if (data.notificationEvent) {
        console.log('Notification event:', data.notificationEvent)
        notificationCallbacks.current.forEach(callback => {
          callback(data.notificationEvent)
        })
      }
      
      // Handle call events
      if (data.callEvent) {
        console.log('Call event:', data.callEvent)
        callCallbacks.current.forEach(callback => {
          callback(data.callEvent)
        })
      }

      // Handle broadcast events
      if (data.broadcastEvent) {
        console.log('Broadcast event:', data.broadcastEvent)
        broadcastCallbacks.current.forEach(callback => {
          callback(data.broadcastEvent)
        })
      }
    }
  })

  const value = {
    subscribeToNotifications,
    subscribeToCallEvents,
    subscribeToBroadcastEvents
  }

  return (
    <SubscriptionsContext.Provider value={value}>
      {children}
    </SubscriptionsContext.Provider>
  )
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext)
  if (!context) {
    throw new Error('useSubscriptions must be used within a SubscriptionsProvider')
  }
  return context
} 