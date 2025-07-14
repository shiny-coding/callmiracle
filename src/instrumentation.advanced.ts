export async function register() {
  // Skip instrumentation on client side
  if (typeof window !== 'undefined') {
    return
  }

  // Only initialize OpenTelemetry in Node.js runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Conditionally import the Node.js-specific instrumentation
    await import('./instrumentation.node')
  }
} 