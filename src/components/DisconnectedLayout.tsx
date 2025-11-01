'use client'

import React from 'react'
import { useWebRTCContext } from '@/hooks/webrtc/WebRTCProvider'
import TopControlsBar from './TopControlsBar'
import BottomControlsBar from './BottomControlsBar'
import DetailedCallHistoryDialog from './DetailedCallHistoryDialog'
import CallerDialog from './CallerDialog'
import CalleeDialog from './CalleeDialog'

interface DisconnectedLayoutProps {
  children: React.ReactNode
}

export default function DisconnectedLayout({ children }: DisconnectedLayoutProps) {
  const { connectionStatus, callee } = useWebRTCContext()
  const showBackground = connectionStatus === 'calling' || connectionStatus === 'receiving-call' || connectionStatus === 'reconnecting' || connectionStatus === 'need-reconnect'

  return (
    <>
      {showBackground && (
        <div className="video-bg-dialog" style={{ backgroundImage: 'url(/space7.jpg)' }} />
      )}
      <div className="flex flex-col w-full" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
        <TopControlsBar />

        <div className="flex flex-col items-center w-full max-w-[1536px] mx-auto grow overflow-hidden">
          <div className="overflow-y-auto px-2 w-full max-w-[800px] grow">
            {children}
          </div>
        </div>

        <BottomControlsBar />

        <DetailedCallHistoryDialog />
        <CallerDialog />
        <CalleeDialog callee={callee} />
      </div>
    </>
  )
}
