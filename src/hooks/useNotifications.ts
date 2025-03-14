import { gql, useQuery, useMutation, useSubscription } from '@apollo/client'
import { getUserId } from '@/lib/userId'
import { ON_CONNECTION_REQUEST } from './webrtc/useWebRTCCommon'

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

export function useNotifications() {
  const userId = getUserId()
  
  const { data, loading, error, refetch } = useQuery(GET_NOTIFICATIONS, {
    variables: { userId },
    pollInterval: 30000, // Poll every 30 seconds
    skip: !userId
  })
  
  const [markAsSeen] = useMutation(SET_NOTIFICATION_SEEN)
  
  // Subscribe to new notifications
  useSubscription(ON_CONNECTION_REQUEST, {
    variables: { userId: getUserId() },
    onSubscriptionData: ({ subscriptionData }) => {
      const notificationEvent = subscriptionData.data?.onConnectionRequest?.notificationEvent
      if (notificationEvent && notificationEvent.type === 'new-notification') {
        refetch()
      }
    }
  })
  
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
  
  return {
    notifications: data?.notifications || [],
    loading,
    error,
    refetch,
    setNotificationSeen,
    hasUnseenNotifications: data?.notifications?.some((n: any) => !n.seen) || false
  }
} 