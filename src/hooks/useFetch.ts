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
    // Check if x-request-id is already present in headers
    const existingHeaders = init?.headers
    let hasRequestId = false
    
    if (existingHeaders) {
      if (existingHeaders instanceof Headers) {
        hasRequestId = existingHeaders.has('x-request-id')
      } else if (Array.isArray(existingHeaders)) {
        hasRequestId = existingHeaders.some(([key]) => key.toLowerCase() === 'x-request-id')
      } else {
        hasRequestId = Object.keys(existingHeaders).some(key => key.toLowerCase() === 'x-request-id')
      }
    }

    // Only add request ID if one doesn't already exist
    const enhancedInit: RequestInit = {
      ...init,
      headers: {
        ...init?.headers,
        ...(hasRequestId ? {} : { 'x-request-id': generateShortRequestId() })
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