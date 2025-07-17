
export async function register() {
  // Skip instrumentation on client side
  if (typeof window !== 'undefined') {
    return
  }

  // Handle different runtimes
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Use our custom instrumentation for better control
    // console.log('Loading custom OpenTelemetry instrumentation...')

    await import('./instrumentation.node')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    // Import edge-specific instrumentation
    await import('./instrumentation-edge')
  } else {
    // Fallback for unknown runtime
    console.log('Unknown runtime - skipping OpenTelemetry instrumentation')
  }
} 