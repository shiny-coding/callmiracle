'use client'

import ConversationsList from '@/components/ConversationsList'
import DeferredRender from '@/components/DeferredRender'

export default function ConversationsPage() {
  return (
    <DeferredRender>
      <ConversationsList />
    </DeferredRender>
  )
} 