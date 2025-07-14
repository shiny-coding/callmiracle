import { registerOTel } from '@vercel/otel'

export async function register() {
  // Skip instrumentation on client side
  if (typeof window !== 'undefined') {
    return
  }

  // Handle different runtimes
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize OpenTelemetry in Node.js runtime
    registerOTel({
      serviceName: process.env.OTEL_SERVICE_NAME || 'callmiracle',
    })
    
    console.log('OpenTelemetry instrumentation initialized with @vercel/otel (Node.js)')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    // Import edge-specific instrumentation
    await import('./instrumentation-edge')
  } else {
    // Fallback for unknown runtime
    console.log('Unknown runtime - skipping OpenTelemetry instrumentation')
  }
} 