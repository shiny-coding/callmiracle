// Version number - update this when you make changes to force update
const VERSION = '1.0.17'
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

  event.waitUntil(
    (async () => {
      // For incoming calls, check if app is visible in foreground
      if (data.data.notificationType === 'INCOMING_CALL') {
        const clientsList = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        })

        // Check if any client window is visible (focused or visible)
        const hasVisibleClient = clientsList.some(client =>
          client.visibilityState === 'visible'
        )

        if (hasVisibleClient) {
          console.log('App is visible in foreground, skipping INCOMING_CALL notification')
          return // Don't show notification if app is in foreground
        }
      }

      // Trigger vibration for incoming calls (if supported)
      if (data.data.notificationType === 'INCOMING_CALL' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200, 100, 200])
      }

      await self.registration.showNotification(data.title, options)
    })()
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

  console.log('[SW] Notification data:', {
    url: notificationData?.url,
    notificationType,
    action,
    targetUrl
  })

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

  // ALWAYS store to IndexedDB first - iOS PWA workaround
  // On iOS, even if clients.matchAll finds a client, it may be a stale/background client
  // that won't properly receive postMessage. The app checks IndexedDB on startup.
  const storeToIndexedDB = () => {
    return new Promise((resolve) => {
      const pendingNavigation = {
        id: 'pending',
        url: targetUrl,
        notificationType: notificationType,
        timestamp: Date.now()
      }
      console.log('[SW] Storing navigation to IndexedDB:', JSON.stringify(pendingNavigation))

      try {
        const dbRequest = indexedDB.open('callmiracle-push-nav', 1)

        dbRequest.onupgradeneeded = (event) => {
          console.log('[SW] IndexedDB upgrade needed, creating navigation store')
          const db = event.target.result
          if (!db.objectStoreNames.contains('navigation')) {
            db.createObjectStore('navigation', { keyPath: 'id' })
          }
        }

        dbRequest.onsuccess = (event) => {
          console.log('[SW] IndexedDB opened successfully')
          try {
            const db = event.target.result
            const tx = db.transaction('navigation', 'readwrite')
            const store = tx.objectStore('navigation')
            store.put(pendingNavigation)

            tx.oncomplete = () => {
              console.log('[SW] Successfully stored pending navigation in IndexedDB:', targetUrl)
              resolve(true)
            }
            tx.onerror = (e) => {
              console.error('[SW] IndexedDB transaction error:', e)
              resolve(false)
            }
          } catch (e) {
            console.error('[SW] Error in IndexedDB transaction:', e)
            resolve(false)
          }
        }

        dbRequest.onerror = (e) => {
          console.error('[SW] IndexedDB open error:', e)
          resolve(false)
        }

        // Timeout fallback
        setTimeout(() => {
          console.log('[SW] IndexedDB operation timed out')
          resolve(false)
        }, 1000)
      } catch (e) {
        console.error('[SW] IndexedDB not available:', e)
        resolve(false)
      }
    })
  }

  // Handle navigation
  event.waitUntil(
    storeToIndexedDB().then(() => {
      return clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clientsArr => {
        console.log('[SW] Found clients:', clientsArr.length, clientsArr.map(c => c.url))

        // Look for an existing VISIBLE window on our domain
        const existingClient = clientsArr.find(client => {
          return client.url.includes(self.location.origin) && client.visibilityState === 'visible'
        })

        if (existingClient) {
          console.log('[SW] Found existing VISIBLE client:', existingClient.url)

          // Check if we're already on the target URL (just need to focus)
          const existingUrl = new URL(existingClient.url)
          const targetUrlObj = new URL(targetUrl, self.location.origin)

          if (existingUrl.pathname === targetUrlObj.pathname &&
              existingUrl.search === targetUrlObj.search) {
            console.log('[SW] Already on target page, just focusing')
            return existingClient.focus()
          }

          // Try postMessage for visible client
          console.log('[SW] Sending postMessage to navigate to:', targetUrl)
          existingClient.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: targetUrl,
            notificationType: notificationType
          })

          return existingClient.focus()
        } else {
          // No visible window - open new one (or bring background one to foreground)
          // iOS often ignores the URL parameter and opens to start_url
          // That's why we stored to IndexedDB first - app will check it on startup
          console.log('[SW] No visible client, opening window:', targetUrl)

          return clients.openWindow(targetUrl).then(async (windowClient) => {
            console.log('[SW] Window opened:', windowClient?.url)

            // Also try postMessage with delays as backup
            if (windowClient) {
              const sendNavigationMessage = () => {
                console.log('[SW] Sending delayed postMessage')
                windowClient.postMessage({
                  type: 'NOTIFICATION_CLICK',
                  url: targetUrl,
                  notificationType: notificationType
                })
              }

              setTimeout(sendNavigationMessage, 500)
              setTimeout(sendNavigationMessage, 1500)
              setTimeout(sendNavigationMessage, 3000)
            }

            return windowClient
          })
        }
      })
    }).catch(error => {
      console.error('[SW] Error handling notification click:', error)
      return clients.openWindow(targetUrl)
    })
  )

  // Fire tracking promises in background (don't wait for them)
  Promise.all(trackingPromises).catch(err => {
    console.error('Error tracking notification click:', err)
  })
}) 