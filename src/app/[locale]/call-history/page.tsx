'use client';

import CallHistory from '@/components/CallHistory';
import DeferredRender from '@/components/DeferredRender';

export default function CallHistoryPage() {
  return (
    <DeferredRender>
      <CallHistory />
    </DeferredRender>
  )
}