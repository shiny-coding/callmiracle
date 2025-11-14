import { useEffect } from 'react'

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

      // Save subscription (duplicates are handled server-side)
      await fetch('/api/save-fcm-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription }),
      });
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
    }
};

export function useClientPushNotifications(currentUser: any) {
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