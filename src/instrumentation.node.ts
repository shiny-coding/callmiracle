import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions'

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

// Get configuration from environment variables
const serviceName = process.env.OTEL_SERVICE_NAME || 'callmiracle'
const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0'
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'

console.log('🔧 Initializing OpenTelemetry with:', {
  serviceName,
  serviceVersion,
  otlpEndpoint,
  nodeEnv: process.env.NODE_ENV
})

// Configure trace exporter
const traceExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
  headers: {},
})

// Configure resource with proper attributes
const resource = resourceFromAttributes({
  ATTR_SERVICE_NAME: serviceName,
  ATTR_SERVICE_VERSION: serviceVersion,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT: process.env.NODE_ENV || 'development',
})

// Initialize OpenTelemetry SDK with advanced configuration
const sdk = new NodeSDK({
  resource: resource,
  spanProcessor: new BatchSpanProcessor(traceExporter, {
    maxExportBatchSize: 100,
    maxQueueSize: 1000,
    exportTimeoutMillis: 30000,
    scheduledDelayMillis: 5000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable some instrumentations if needed
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable file system instrumentation to reduce noise
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        requestHook: (span: any, request: any) => {
          // Add custom attributes to HTTP spans
          span.setAttributes({
            'http.request.body.size': request.headers['content-length'] || 0,
            'http.user_agent': request.headers['user-agent'] || '',
          })
        },
        responseHook: (span: any, response: any) => {
          // Add response attributes
          span.setAttributes({
            'http.response.body.size': response.headers['content-length'] || 0,
          })
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-graphql': {
        enabled: true,
        allowValues: true,
        depth: 2,
      },
      '@opentelemetry/instrumentation-mongodb': {
        enabled: true,
      },
    }),
  ],
})

// Start the SDK
console.log('🚀 Starting OpenTelemetry SDK...')
sdk.start()
console.log('✅ OpenTelemetry SDK started successfully')

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down OpenTelemetry...')
  sdk.shutdown()
    .then(() => console.log('✅ OpenTelemetry terminated'))
    .catch((error) => console.log('❌ Error terminating OpenTelemetry', error))
    .finally(() => process.exit(0))
}) 