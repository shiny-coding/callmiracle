import { useEffect } from 'react'
import { generateShortRequestId } from '@/utils/commonUtils'

let isGlobalFetchPatched = false

/**
 * Patches the global fetch function to automatically include request ID headers
 */
function patchGlobalFetch() {
  if (isGlobalFetchPatched || typeof window === 'undefined') return
  
  const originalFetch = window.fetch
  
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Generate a unique request ID for this request
    const requestId = generateShortRequestId()
    
    // Merge headers with the request ID
    const enhancedInit: RequestInit = {
      ...init,
      headers: {
        ...init?.headers,
        'x-request-id': requestId
      }
    }
    
    return originalFetch(input, enhancedInit)
  }
  
  isGlobalFetchPatched = true
}

/**
 * Hook that patches the global fetch function to automatically include request IDs
 * Call this once in your app root component
 */
export function useRequestIdInjection() {
  useEffect(() => {
    patchGlobalFetch()
  }, [])
}

/**
 * Manually patch fetch for use in non-React contexts
 */
export function initializeRequestIdInjection() {
  patchGlobalFetch()
}