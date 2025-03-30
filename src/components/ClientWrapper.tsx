'use client'

import { StoreInitializer } from '@/components/AppContent'
import { ReactNode } from 'react'

export function ClientWrapper({ children }: { children: ReactNode }) {
  return <StoreInitializer>{children}</StoreInitializer>
} 