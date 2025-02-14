'use client'

import { ReactNode } from 'react'
import { useInitUser } from '@/hooks/useInitUser'

interface AppContentProps {
  children: ReactNode
}

export default function AppContent({ children }: AppContentProps) {
  useInitUser()
  return children
} 