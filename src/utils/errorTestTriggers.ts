/**
 * UI-level error trigger utilities
 * These functions are called from UI components and create deep call stacks
 */

import { triggerTestException, triggerTestPromiseRejection, triggerTestAsyncError } from './errorTestHelpers'
import clientLogger from './clientLogger'

/**
 * Trigger from menu action
 */
export function triggerMenuException(): void {
  clientLogger.debug('Menu exception trigger initiated', {
    userAction: 'menu_click',
    component: 'MediaControls'
  })

  triggerTestException('menu')
}

/**
 * Trigger promise rejection from menu
 */
export function triggerMenuPromiseRejection(): void {
  clientLogger.debug('Menu promise rejection trigger initiated', {
    userAction: 'menu_click',
    component: 'MediaControls'
  })

  triggerTestPromiseRejection('menu')
}

/**
 * Trigger async error from menu
 */
export function triggerMenuAsyncError(): void {
  clientLogger.debug('Menu async error trigger initiated', {
    userAction: 'menu_click',
    component: 'MediaControls'
  })

  // Don't await - let it be unhandled
  triggerTestAsyncError('menu').catch(() => {
    // Intentionally empty to make it unhandled
  })
}

/**
 * Trigger with complex metadata for testing
 */
export function triggerComplexException(): void {
  const context = {
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    url: window.location.href,
    memory: (performance as any).memory ? {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize
    } : null
  }

  clientLogger.info('Triggering complex exception with context', context)

  triggerTestException('complex-test')
}
