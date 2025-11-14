// Version number - update this when you make changes to force update
const VERSION = '1.0.4'
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
      notificationId: data.data.notificationId
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const notificationId = event.notification.data?.notificationId
  console.log('Notification clicked, notificationId:', notificationId, 'data:', event.notification.data)

  const targetUrl = event.notification.data?.url || '/'

  // Wait for both fetch requests to complete before navigating
  const trackingPromises = [
    fetch('/api/track-notification-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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