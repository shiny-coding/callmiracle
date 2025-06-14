self.addEventListener('push', event => {
  const data = event.data.json()
  console.log('New push notification', data)

  const options = {
    body: data.body,
    icon: '/logo-192.png',
    badge: '/logo-72.png',
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