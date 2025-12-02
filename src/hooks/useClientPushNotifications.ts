import { useEffect } from 'react'
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

  // Listen for messages from service worker (notification clicks)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      clientLogger.info('[PushNotifications] Service worker not supported')
      return
    }

    clientLogger.info('[PushNotifications] Setting up message listener for SW')

    const handleMessage = (event: MessageEvent) => {
      clientLogger.info('[PushNotifications] Received message from SW', {
        type: event.data?.type,
        url: event.data?.url,
        notificationType: event.data?.notificationType
      })

      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const { url } = event.data
        if (url) {
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

          clientLogger.info('[PushNotifications] Navigating via router.push', {
            originalUrl: url,
            relativePath,
            currentPath,
            currentPathWithoutLocale
          })

          // Check if we're already on this page (compare without locale)
          if (currentPathWithoutLocale === relativePath) {
            clientLogger.info('[PushNotifications] Already on target page, triggering refresh instead')
            // Dispatch a custom event to refresh the messages
            window.dispatchEvent(new CustomEvent('refreshConversation', {
              detail: { url: relativePath }
            }))
            return
          }

          // Use Next.js router for client-side navigation (no refresh)
          // scroll: false prevents auto-scroll issues with sticky/fixed elements
          router.push(relativePath, { scroll: false })
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    clientLogger.info('[PushNotifications] Message listener registered')

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      clientLogger.info('[PushNotifications] Message listener removed')
    }
  }, [router])

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