// Version number - update this when you make changes to force update
const VERSION = '1.0.6'
console.log('Service Worker version:', VERSION)

// Install event - activate immediately
self.addEventListener('install', event => {
  console.log('Service Worker installing, version:', VERSION)
  self.skipWaiting() // Force the waiting service worker to become the active service worker
})

// Activate event - take control of all pages immediately
self.addEventListener('activate', event => {
  console.log('Service Worker activating, version:', VERSION)
  event.waitUntil(
    self.clients.claim() // Take control of all pages immediately
  )
})

self.addEventListener('push', event => {
  const data = event.data.json()
  console.log('New push notification', data)

  const options = {
    body: data.body,
    icon: '/logo-192.png',
    badge: '/logo-72.png',
    data: {
      url: data.data.url,
      notificationId: data.data.notificationId,
      callId: data.data.callId,
      meetingId: data.data.meetingId,
      initiatorUserId: data.data.initiatorUserId,
      notificationType: data.data.notificationType
    },
    tag: data.tag,
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    vibrate: data.data.notificationType === 'INCOMING_CALL' ? [200, 100, 200, 100, 200, 100, 200] : [200]
  }

  // Trigger vibration for incoming calls (if supported)
  if (data.data.notificationType === 'INCOMING_CALL' && 'vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 200, 100, 200])
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

self.addEventListener('notificationclick', event => {
  const action = event.action
  const notificationData = event.notification.data
  const notificationId = notificationData?.notificationId
  const callId = notificationData?.callId
  const meetingId = notificationData?.meetingId
  const initiatorUserId = notificationData?.initiatorUserId
  const notificationType = notificationData?.notificationType

  console.log('Notification clicked', {
    action,
    notificationId,
    callId,
    meetingId,
    initiatorUserId,
    notificationType
  })

  // Close notification for all actions
  event.notification.close()

  // Handle different actions
  if (action === 'decline') {
    // For decline action, just close the notification and don't open the app
    console.log('Call declined by user')

    // Track the decline action
    event.waitUntil(
      fetch('/api/track-notification-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', callId }),
        credentials: 'include'
      }).catch(err => console.error('Failed to track decline action:', err))
    )
    return
  }

  // For answer action or default click, open the app
  let targetUrl = notificationData?.url || '/'

  // If it's an incoming call and user clicked answer
  if (action === 'answer' && notificationType === 'INCOMING_CALL') {
    if (meetingId) {
      // Meeting call - go to meeting page
      targetUrl = `/list?meetingId=${meetingId}&autoAnswer=true`
    } else if (initiatorUserId) {
      // Direct call - go to call history with that user
      targetUrl = `/call-history?with=${initiatorUserId}&autoAnswer=true`
    }
  }

  // Wait for both fetch requests to complete before navigating
  const trackingPromises = [
    fetch('/api/track-notification-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action || 'click', callId }),
      credentials: 'include'
    }).catch(err => console.error('Failed to track notification click:', err))
  ]

  if (notificationId) {
    console.log('Marking notification as seen:', notificationId)
    trackingPromises.push(
      fetch('/api/mark-notification-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
        credentials: 'include'
      }).catch(err => console.error('Failed to mark notification as seen:', err))
    )
  } else {
    console.log('No notificationId found in notification data')
  }

  event.waitUntil(
    Promise.all(trackingPromises).then(() =>
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clientsArr => {
      // Look for an existing window that we can navigate to the target URL
      const existingClient = clientsArr.find(client => {
        // Check if there's a window open to our domain
        return client.url.includes(self.location.origin)
      })

      if (existingClient) {
        // Navigate existing window to target URL and focus it
        return existingClient.navigate(targetUrl).then(client => {
          if (client) {
            return client.focus()
          }
          // If navigate fails, try to focus the existing client
          return existingClient.focus()
        }).catch(() => {
          // If both navigate and focus fail, try opening a new window
          return clients.openWindow(targetUrl)
        })
      } else {
        // No existing window, open a new one
        return clients.openWindow(targetUrl)
      }
    }).catch(error => {
      console.error('Error handling notification click:', error)
      // Fallback: try to open new window
      return clients.openWindow(targetUrl)
    }))
  )
}) 