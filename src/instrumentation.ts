export async function register() {

  console.log('🚀 Starting CallMiracle application...')
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🆔 Server ID: ${process.env.SERVER_ID || 'unknown'}`)

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