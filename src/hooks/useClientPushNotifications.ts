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
        if ('serviceWorker' in navigator && window.PushManager) {
            try {
                const swReg = await navigator.serviceWorker.register('/sw.js')
                console.log('Service Worker is registered', swReg)

                if (Notification.permission === 'granted') {
                    await subscribeToPushNotifications()
                } else if (Notification.permission === 'default') {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        await subscribeToPushNotifications()
                    }
                }
            } catch (error) {
                console.error('Service Worker Error or Push Subscription failed', error)
            }
        }
    }

    registerAndSubscribe()
  }, [currentUser])
} 