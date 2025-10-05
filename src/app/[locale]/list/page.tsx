'use client';

import MeetingsList from '@/components/MeetingsList';
import DeferredRender from '@/components/DeferredRender';

export default function ListPage() {
  return (
    <DeferredRender>
      <MeetingsList />
    </DeferredRender>
  )
}