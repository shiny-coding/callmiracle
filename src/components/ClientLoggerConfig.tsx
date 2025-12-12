'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import clientLogger, { LogLevel } from '@/utils/clientLogger'
import { defaultClientLogLevel } from '@/utils/logUtils'

export default function ClientLoggerConfig() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.clientLogLevel) {
      clientLogger.setLogLevel(session.user.clientLogLevel as LogLevel)
      // Set section-specific log levels if available
      if (session.user.clientSectionLogLevels) {
        clientLogger.setSectionLogLevels(session.user.clientSectionLogLevels)
      }
    } else {
      // Set default level for unauthenticated users
      clientLogger.setLogLevel(defaultClientLogLevel as LogLevel)
      clientLogger.setSectionLogLevels({})
    }
  }, [session, status])

  // This component doesn't render anything
  return null
} 