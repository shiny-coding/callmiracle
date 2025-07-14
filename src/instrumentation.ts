import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

export function register() {
  // Get configuration from environment variables
  const serviceName = process.env.OTEL_SERVICE_NAME || 'callmiracle'
  const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0'
  const environment = process.env.NODE_ENV || 'development'
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
    headers: {},
  })

  // Initialize OpenTelemetry SDK
  const sdk = new NodeSDK({
    serviceName,
    traceExporter,
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
  sdk.start()
  
  console.log('OpenTelemetry instrumentation initialized for', serviceName)

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('OpenTelemetry terminated'))
      .catch((error) => console.log('Error terminating OpenTelemetry', error))
      .finally(() => process.exit(0))
  })
} 