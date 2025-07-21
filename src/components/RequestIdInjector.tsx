'use client'

import { useRequestIdInjection } from '@/hooks/useFetch'

/**
 * Component that initializes global request ID injection for all fetch requests
 */
export default function RequestIdInjector() {
  useRequestIdInjection()
  return null
}