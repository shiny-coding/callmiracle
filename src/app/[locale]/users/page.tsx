'use client';

import UserList from '@/components/UserList';
import DeferredRender from '@/components/DeferredRender';

export default function UsersPage() {
  return (
    <DeferredRender>
      <UserList />
    </DeferredRender>
  )
}