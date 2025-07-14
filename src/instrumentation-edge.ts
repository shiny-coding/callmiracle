// Edge Runtime instrumentation - minimal setup
export function register() {
  // Skip instrumentation in edge runtime for now
  // Edge runtime has limited capabilities compared to Node.js
  console.log('Edge Runtime - OpenTelemetry instrumentation skipped')
} 