export async function register() {
  // Skip instrumentation on client side
  if (typeof window !== 'undefined') {
    return
  }

  console.log('🚀 Starting CallMiracle application...')
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🆔 Server ID: ${process.env.SERVER_ID || 'unknown'}`)

  // Force load Redis PubSub early to test connection at startup
  try {
    await import('./resolvers/pubsub')
    // Give Redis a moment to establish connection
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('✅ Redis PubSub connection verified')
  } catch (error) {
    console.error('❌ Redis PubSub connection failed:', error)
    process.exit(1)
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