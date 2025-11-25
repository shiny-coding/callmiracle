'use client'

import NotificationsList from '@/components/NotificationsList'
import DeferredRender from '@/components/DeferredRender'

export default function NotificationsPage() {
  return (
    <DeferredRender>
      <NotificationsList />
    </DeferredRender>
  )
}
