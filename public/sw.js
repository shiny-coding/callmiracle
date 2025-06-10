self.addEventListener('push', event => {
  const data = event.data.json()
  console.log('New notification', data)

  const options = {
    body: data.body,
    icon: '/icon-192x192.png', // You should create this icon file
    badge: '/badge-72x72.png', // You should create this badge file
    data: {
      url: data.data.url
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientsArr => {
      const hadWindowToFocus = clientsArr.some(windowClient => windowClient.url === event.notification.data.url ? (windowClient.focus(), true) : false)

      if (!hadWindowToFocus) clients.openWindow(event.notification.data.url || '/').then(windowClient => windowClient ? windowClient.focus() : null)
    })
  )
}) 