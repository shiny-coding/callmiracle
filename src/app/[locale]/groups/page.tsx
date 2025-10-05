'use client'

import GroupList from '@/components/GroupList'
import DeferredRender from '@/components/DeferredRender'

export default function GroupsPage() {
  return (
    <DeferredRender>
      <GroupList />
    </DeferredRender>
  )
} 