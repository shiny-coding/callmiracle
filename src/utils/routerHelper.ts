import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

/**
 * Helper function for router navigation with debugging capabilities
 * @param router - Next.js router instance
 * @param path - Path to navigate to
 * @param debugInfo - Optional debug information object
 */
export function routerPush(router: AppRouterInstance, path: string, debugInfo?: Record<string, any>) {
  console.log('🔗 Router navigation:', {
    from: typeof window !== 'undefined' ? window.location.pathname : 'server',
    to: path,
    timestamp: new Date().toISOString(),
    ...debugInfo
  })
  
  router.push(path)
}