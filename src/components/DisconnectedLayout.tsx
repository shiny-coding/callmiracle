'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import TopControlsBar from './TopControlsBar'
import BottomControlsBar from './BottomControlsBar'
import DetailedCallHistoryDialog from './DetailedCallHistoryDialog'
import CallerDialog from './CallerDialog'
import CalleeDialog from './CalleeDialog'
import CallEndedDialog from './CallEndedDialog'

interface DisconnectedLayoutProps {
  children: React.ReactNode
}

export default function DisconnectedLayout({ children }: DisconnectedLayoutProps) {
  const pathname = usePathname()
  const { connectionStatus, callee } = useWebRTCContext()
  const showBackground = connectionStatus === 'calling' || connectionStatus === 'receiving-call'
  const isFirstTimePage = pathname?.includes('/first-time')

  return (
    <>
      {showBackground && (
        <div className="video-bg-dialog" style={{ backgroundImage: 'url(/space7.jpg)' }} />
      )}
      <div className="flex flex-col w-full" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        {!isFirstTimePage && <TopControlsBar />}

        <div className="flex flex-col items-center w-full max-w-[1536px] mx-auto grow overflow-hidden">
          <div className="overflow-y-auto px-2 py-1 w-full max-w-[800px] grow">
            {children}
          </div>
        </div>

        {!isFirstTimePage && <BottomControlsBar />}

        <DetailedCallHistoryDialog />
        <CallerDialog />
        <CalleeDialog callee={callee} />
        <CallEndedDialog />
      </div>
    </>
  )
}
