import { trace } from '@opentelemetry/api'
import { getLogger, addTraceToLog } from './logger'

/**
 * Test function to verify observability setup
 * This function creates traces and logs to test the integration
 */
export async function testObservability() {
  const logger = await getLogger()
  const tracer = trace.getTracer('callmiracle-test')

  // Test 1: Basic logging
  logger.info('🧪 Testing observability setup...')

  // Test 2: Create a test span with logs
  const span = tracer.startSpan('test-operation')
  try {
    span.setAttributes({
      'test.type': 'observability-setup',
      'test.component': 'winston-loki-tempo',
      'test.timestamp': new Date().toISOString()
    })

    logger.info('📊 Creating test trace span', addTraceToLog({
      testType: 'tracing',
      operation: 'test-operation'
    }))

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100))

    // Test 3: Log different levels
    logger.debug('🐛 Debug log test')
    logger.info('ℹ️ Info log test')
    logger.warn('⚠️ Warning log test')

    // Test 4: Structured logging
    logger.info('📝 Structured log test', addTraceToLog({
      user: 'test-user',
      action: 'observability-test',
      metadata: {
        testData: 'success',
        timestamp: new Date().toISOString()
      }
    }))

    logger.info('✅ Observability test completed successfully')

  } catch (error) {
    span.recordException(error as Error)
    logger.error('❌ Observability test failed', addTraceToLog({
      error: (error as Error).message,
      stack: (error as Error).stack
    }))
    throw error
  } finally {
    span.end()
  }
}

/**
 * Simple function to run observability tests
 * Can be called directly from Node.js
 */
export async function runObservabilityTests() {
  console.log('🚀 Starting observability tests...')
  
  try {
    await testObservability()
    console.log('✅ All observability tests passed!')
    
    console.log('\n📋 Next steps:')
    console.log('1. Check Grafana: http://localhost:3001 (admin/admin)')
    console.log('2. Look for logs in Loki datasource')
    console.log('3. Look for traces in Tempo datasource')
    console.log('4. Check the console output above for any errors')
    
  } catch (error) {
    console.error('❌ Observability tests failed:', error)
    process.exit(1)
  }
} 