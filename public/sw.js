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

  const targetUrl = event.notification.data?.url || '/'
  
  event.waitUntil(
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
    })
  )
}) 