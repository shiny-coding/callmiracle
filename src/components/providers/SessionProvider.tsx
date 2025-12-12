'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

// Refetch session every 5 minutes to pick up changes to user settings (log levels, etc.)
const REFETCH_INTERVAL_SECONDS = 5 * 60

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider refetchInterval={REFETCH_INTERVAL_SECONDS}>
      {children}
    </NextAuthSessionProvider>
  )
}

