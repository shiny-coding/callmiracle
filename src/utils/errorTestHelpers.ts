/**
 * Test utilities for triggering errors with sophisticated call stacks
 * This helps test error logging, stack trace capture, and source map resolution
 */


/**
 * Level 3: The actual error thrower
 * This is the deepest level in our test call stack
 */
export function throwTestError(message: string): never {
  // Log before throwing to test logger's error capture
  console.log('About to throw test error', {
    message,
    location: 'errorTestHelpers.throwTestError',
    sourceFile: 'src/utils/errorTestHelpers.ts',
    sourceLine: 19
  })

  const error = new Error(message)
  // Add source location as property for easier debugging
  ;(error as any).sourceFile = 'src/utils/errorTestHelpers.ts:19'
  throw error
}

/**
 * Level 2: Business logic that calls the thrower
 * This simulates a service/utility function
 */
export function processTestOperation(operation: string): void {
  console.log('Processing test operation', {
    operation,
    location: 'errorTestHelpers.processTestOperation'
  })

  // Simulate some logic before error

  const errorMessage = `Test exception from ${operation}!`

  // Call deeper function
  throwTestError(errorMessage)
}

/**
 * Level 1: UI action handler
 * This simulates a user action triggering business logic
 */
export function triggerTestException(source: string = 'unknown'): void {
  console.log('Test exception triggered by user', {
    source,
    location: 'errorTestHelpers.triggerTestException'
  })

  // Use setTimeout to ensure this is an unhandled error
  // (not caught by React error boundaries or try-catch)
  setTimeout(() => {
    processTestOperation(source)
  }, 100)
}

/**
 * Alternative: Trigger a promise rejection error
 */
export function triggerTestPromiseRejection(source: string = 'unknown'): void {
  console.log('Test promise rejection triggered by user', {
    source,
    location: 'errorTestHelpers.triggerTestPromiseRejection'
  })

  // Create an unhandled promise rejection
  Promise.reject(new Error(`Promise rejection test from ${source} - check Grafana!`))
}

/**
 * Trigger an error with async/await chain
 */
export async function triggerTestAsyncError(source: string = 'unknown'): Promise<never> {
  console.log('Test async error triggered', {
    source,
    location: 'errorTestHelpers.triggerTestAsyncError'
  })

  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 50))

  // Call business logic
  processTestOperation(`async-${source}`)

  // TypeScript will complain here, but processTestOperation throws, so we never reach this
  throw new Error('Should never reach here')
}
