import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import clientLogger from '@/utils/clientLogger'

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

// Generate or retrieve a stable device ID for this browser/device
function getDeviceId(): string {
    const DEVICE_ID_KEY = 'callmiracle_device_id'
    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    return deviceId
}

const subscribeToPushNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (subscription === null) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.error("VAPID public key is not set.");
          return;
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      // Get stable device ID to deduplicate subscriptions across page refreshes
      const deviceId = getDeviceId()

      // Save subscription with device ID (server uses deviceId to deduplicate)
      await fetch('/api/save-fcm-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription, deviceId }),
      });
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
    }
};

export function useClientPushNotifications(currentUser: any) {
  const router = useRouter()

  // Helper function to handle navigation from notification
  const handleNotificationNavigation = useCallback((url: string, notificationType?: string) => {
    if (!url) {
      clientLogger.info('[PushNotifications] handleNotificationNavigation called with empty url')
      return
    }

    // Convert full URL to relative path for Next.js router
    let relativePath = url
    try {
      const urlObj = new URL(url, window.location.origin)
      relativePath = urlObj.pathname + urlObj.search
    } catch {
      // If URL parsing fails, use as-is
    }

    // Get current path without locale prefix for comparison
    const currentPath = window.location.pathname + window.location.search
    // Remove locale prefix (e.g., /ru, /en) from current path for comparison
    const currentPathWithoutLocale = currentPath.replace(/^\/[a-z]{2}(?=\/|$)/, '')
    // Also remove locale from relativePath for comparison
    const relativePathWithoutLocale = relativePath.replace(/^\/[a-z]{2}(?=\/|$)/, '')

    clientLogger.info('[PushNotifications] Processing navigation', {
      originalUrl: url,
      relativePath,
      currentPath,
      currentPathWithoutLocale,
      relativePathWithoutLocale,
      notificationType
    })

    // Check if we're already on this page (compare without locale)
    if (currentPathWithoutLocale === relativePathWithoutLocale) {
      clientLogger.info('[PushNotifications] Already on target page, triggering refresh instead')
      // Dispatch a custom event to refresh the messages
      window.dispatchEvent(new CustomEvent('refreshConversation', {
        detail: { url: relativePath }
      }))
      return
    }

    // Navigate to the target page
    clientLogger.info('[PushNotifications] Calling router.push', { relativePath })
    router.push(relativePath, { scroll: false })
    clientLogger.info('[PushNotifications] router.push called successfully')
  }, [router])

  // Listen for messages from service worker (notification clicks) via multiple channels
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      clientLogger.info('[PushNotifications] Service worker not supported')
      return
    }

    clientLogger.info('[PushNotifications] Setting up message listeners', {
      currentPath: window.location.pathname + window.location.search,
      swControllerExists: !!navigator.serviceWorker.controller
    })

    // Track if we've already handled a navigation to prevent duplicates
    let handledTimestamp = 0

    const handleNavigation = (url: string, notificationType: string | undefined, timestamp: number) => {
      // Prevent handling the same navigation multiple times
      if (timestamp && timestamp <= handledTimestamp) {
        clientLogger.info('[PushNotifications] Skipping duplicate navigation', { timestamp, handledTimestamp })
        return
      }
      handledTimestamp = timestamp || Date.now()
      handleNotificationNavigation(url, notificationType)
    }

    // Check IndexedDB for pending navigation (iOS cold start workaround)
    // IMPORTANT: Must match the database name used in sw.js ('callmiracle-push-nav')
    const checkIndexedDB = () => {
      clientLogger.info('[PushNotifications] Checking IndexedDB for pending navigation')
      try {
        const dbRequest = indexedDB.open('callmiracle-push-nav', 1)
        dbRequest.onupgradeneeded = (event: any) => {
          clientLogger.info('[PushNotifications] IndexedDB upgrade needed, creating store')
          const db = event.target.result
          if (!db.objectStoreNames.contains('navigation')) {
            db.createObjectStore('navigation', { keyPath: 'id' })
          }
        }
        dbRequest.onsuccess = (event: any) => {
          clientLogger.info('[PushNotifications] IndexedDB opened successfully')
          const db = event.target.result
          try {
            const tx = db.transaction('navigation', 'readwrite')
            const store = tx.objectStore('navigation')
            const getRequest = store.get('pending')

            getRequest.onsuccess = () => {
              const data = getRequest.result
              clientLogger.info('[PushNotifications] IndexedDB get result', {
                hasData: !!data,
                dataUrl: data?.url,
                dataId: data?.id
              })
              if (data && data.url) {
                // Check if the navigation is recent (within last 30 seconds)
                const age = Date.now() - (data.timestamp || 0)
                clientLogger.info('[PushNotifications] Found pending navigation in IndexedDB', {
                  url: data.url,
                  age,
                  timestamp: data.timestamp
                })

                if (age < 30000) {
                  // Delete the pending navigation (key is 'pending' - the id field)
                  store.delete('pending')
                  // Handle the navigation
                  clientLogger.info('[PushNotifications] Navigating from IndexedDB data', { url: data.url })
                  handleNavigation(data.url, data.notificationType, data.timestamp)
                } else {
                  // Too old, just delete it
                  store.delete('pending')
                  clientLogger.info('[PushNotifications] Pending navigation too old, ignoring')
                }
              } else {
                clientLogger.info('[PushNotifications] No pending navigation found in IndexedDB')
              }
            }
          } catch (e) {
            clientLogger.info('[PushNotifications] Error reading from IndexedDB', { error: String(e) })
          }
        }
      } catch (e) {
        clientLogger.info('[PushNotifications] IndexedDB not available', { error: String(e) })
      }
    }

    // Check IndexedDB immediately and after short delays
    checkIndexedDB()
    setTimeout(checkIndexedDB, 500)
    setTimeout(checkIndexedDB, 1500)

    // Also check IndexedDB when page becomes visible (for iOS app switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clientLogger.info('[PushNotifications] Page became visible, checking IndexedDB')
        checkIndexedDB()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen via service worker postMessage
    const handleSWMessage = (event: MessageEvent) => {
      clientLogger.info('[PushNotifications] Received message from SW postMessage', {
        type: event.data?.type,
        url: event.data?.url,
        notificationType: event.data?.notificationType,
        currentPath: window.location.pathname + window.location.search
      })

      if (event.data?.type === 'NOTIFICATION_CLICK') {
        handleNavigation(event.data.url, event.data.notificationType, event.data.timestamp || Date.now())
      }
    }

    navigator.serviceWorker.addEventListener('message', handleSWMessage)

    // Listen via BroadcastChannel (more reliable for cold start on iOS)
    let broadcastChannel: BroadcastChannel | null = null
    try {
      broadcastChannel = new BroadcastChannel('push-notification-navigation')
      broadcastChannel.onmessage = (event) => {
        clientLogger.info('[PushNotifications] Received message from BroadcastChannel', {
          url: event.data?.url,
          notificationType: event.data?.notificationType,
          timestamp: event.data?.timestamp,
          currentPath: window.location.pathname + window.location.search
        })

        if (event.data?.url) {
          handleNavigation(event.data.url, event.data.notificationType, event.data.timestamp)
        }
      }
      clientLogger.info('[PushNotifications] BroadcastChannel listener registered')
    } catch (e) {
      clientLogger.info('[PushNotifications] BroadcastChannel not available', { error: String(e) })
    }

    clientLogger.info('[PushNotifications] Message listeners registered')

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (broadcastChannel) {
        broadcastChannel.close()
      }
      clientLogger.info('[PushNotifications] Message listeners removed')
    }
  }, [handleNotificationNavigation])

  useEffect(() => {
    if (!currentUser?._id) return

    const registerAndSubscribe = async () => {
      if (!('serviceWorker' in navigator) || !window.PushManager) {
        return
      }

      try {
        // Register service worker (will check for updates on registration)
        // updateViaCache: 'none' ensures changes are picked up immediately
        const registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none'
        })

        // Check for updates when the page becomes visible
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(err => {
              console.error('Failed to update service worker:', err)
            })
          }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Check platform
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const isAndroid = /Android/.test(navigator.userAgent)
        const isDesktop = !isIOS && !isAndroid

        // Check if running as PWA (standalone mode)
        const isStandalone = ('standalone' in window.navigator) && (window.navigator as any).standalone
        const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches
        const isPWA = isStandalone || isDisplayModeStandalone

        if (Notification.permission === 'granted') {
          await subscribeToPushNotifications()
        }
        // Note: We no longer automatically request permission here
        // Permission is now requested through NotificationPermissionRequestScreen
        // to provide better UX and context to the user
      } catch (error) {
        console.error('Service Worker Error or Push Subscription failed', error)
      }
    }

    registerAndSubscribe()
  }, [currentUser])
} 