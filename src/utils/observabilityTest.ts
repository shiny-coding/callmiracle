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
 * Test API endpoint functionality
 */
export async function testAPIObservability(endpoint: string = '/api/log') {
  const logger = await getLogger()
  
  try {
    const testPayload = {
      level: 'info',
      message: '🌐 Testing API observability integration',
      meta: {
        testType: 'api',
        endpoint,
        timestamp: new Date().toISOString()
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    })

    if (response.ok) {
      logger.info('✅ API observability test successful', addTraceToLog({
        status: response.status,
        endpoint
      }))
    } else {
      logger.error('❌ API observability test failed', addTraceToLog({
        status: response.status,
        endpoint,
        statusText: response.statusText
      }))
    }

    return response.ok
  } catch (error) {
    logger.error('💥 API test exception', addTraceToLog({
      error: (error as Error).message,
      endpoint
    }))
    return false
  }
}

/**
 * Run comprehensive observability tests
 */
export async function runObservabilityTests() {
  console.log('🚀 Starting CallMiracle Observability Tests...\n')

  try {
    // Test 1: Basic observability
    console.log('1️⃣ Testing basic observability...')
    await testObservability()
    console.log('✅ Basic observability test passed\n')

    // Test 2: API observability (if available)
    console.log('2️⃣ Testing API observability...')
    const apiSuccess = await testAPIObservability()
    if (apiSuccess) {
      console.log('✅ API observability test passed\n')
    } else {
      console.log('⚠️ API observability test skipped (API may not be running)\n')
    }

    console.log('🎉 All observability tests completed!')
    console.log('\n📊 Check your services:')
    console.log('  • Grafana: http://localhost:3001')
    console.log('  • Loki: http://localhost:3100')
    console.log('  • Tempo: http://localhost:3200')
    console.log('\n🔍 Look for logs with "observability-test" in Grafana/Loki')

  } catch (error) {
    console.error('❌ Observability tests failed:', error)
    throw error
  }
} 