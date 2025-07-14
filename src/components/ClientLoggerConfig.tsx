'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import clientLogger from '@/utils/clientLogger'
import { defaultClientLogLevel } from '@/utils/logUtils'

export default function ClientLoggerConfig() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.clientLogLevel) {
      clientLogger.setLogLevel(session.user.clientLogLevel)
    } else {
      // Set default level for unauthenticated users
      clientLogger.setLogLevel(defaultClientLogLevel)
    }
  }, [session, status])

  // This component doesn't render anything
  return null
} 