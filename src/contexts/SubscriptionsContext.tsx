'use client'
import React, { createContext, useContext, ReactNode, useCallback } from 'react'
import { gql, useSubscription } from '@apollo/client'
import { getUserId } from '@/lib/userId'

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
          userId
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
          userId
          name
        }
      }
    }
  }
`

interface SubscriptionsContextType {
  subscribeToNotifications: (callback: (event: any) => void) => void
  subscribeToMeetings: (callback: (event: any) => void) => void
  subscribeToCallEvents: (callback: (event: any) => void) => void
}

const SubscriptionsContext = createContext<SubscriptionsContextType | null>(null)

export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  // Store callbacks in refs to avoid unnecessary re-renders
  const notificationCallbacks = React.useRef<((event: any) => void)[]>([])
  const meetingCallbacks = React.useRef<((event: any) => void)[]>([])
  const callCallbacks = React.useRef<((event: any) => void)[]>([])

  // Register callbacks
  const subscribeToNotifications = useCallback((callback: (event: any) => void) => {
    notificationCallbacks.current.push(callback)
    return () => {
      notificationCallbacks.current = notificationCallbacks.current.filter(cb => cb !== callback)
    }
  }, [])

  const subscribeToMeetings = useCallback((callback: (event: any) => void) => {
    meetingCallbacks.current.push(callback)
    return () => {
      meetingCallbacks.current = meetingCallbacks.current.filter(cb => cb !== callback)
    }
  }, [])

  const subscribeToCallEvents = useCallback((callback: (event: any) => void) => {
    callCallbacks.current.push(callback)
    return () => {
      callCallbacks.current = callCallbacks.current.filter(cb => cb !== callback)
    }
  }, [])

  // Central subscription that distributes events to all registered callbacks
  useSubscription(ON_SUBSCRIPTION_EVENT, {
    variables: { userId: getUserId() },
    onSubscriptionData: ({ subscriptionData }) => {
      const data = subscriptionData.data?.onSubscriptionEvent
      
      if (!data) return
      
      // Handle notification events
      if (data.notificationEvent) {
        notificationCallbacks.current.forEach(callback => {
          callback(data.notificationEvent)
        })
      }
      
      // Handle meeting events (connection/disconnection)
      if (data.notificationEvent?.type === 'meeting-connected' || 
          data.notificationEvent?.type === 'meeting-disconnected') {
        meetingCallbacks.current.forEach(callback => {
          callback(data.notificationEvent)
        })
      }
      
      // Handle call events
      if (data.callEvent) {
        callCallbacks.current.forEach(callback => {
          callback(data.callEvent)
        })
      }
    }
  })

  const value = {
    subscribeToNotifications,
    subscribeToMeetings,
    subscribeToCallEvents,
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