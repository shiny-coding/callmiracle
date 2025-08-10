import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions'
import { trace, context as otelContext } from '@opentelemetry/api'
import '@/lib/pubsub' // No exports imported, just execute the module

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { createMiddlewareSpanName } from './utils/middleware-tracing'
import { UserSampler } from './instrumentation/user-sampler'
import { extractJWTFromCookieHeader, getUserIdFromJWT } from './utils/jwt'

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
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: serviceVersion,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
})

function addTraceAttribute(header: string, attribute: string, headers: any, span: any) {
  if (headers[header]) {
    span.setAttributes({
      [attribute]: headers[header]
    })
  }
}

function extractUserIdFromCookie(cookieHeader: string): string | null {
  try {
    const token = extractJWTFromCookieHeader(cookieHeader)
    return getUserIdFromJWT(token)
  } catch (error) {
    return null
  }
}


// Initialize OpenTelemetry SDK with user-aware sampler
const sdk = new NodeSDK({
  resource: resource,
  sampler: new UserSampler({
    fallbackSamplingRate: 0.1, // 10% sampling for anonymous users
  }),
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
        enabled: false, // Disabfile system instrumentation to reduce noise
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        startIncomingSpanHook: (request: any) => {
          // This runs BEFORE sampling decision - extract user ID from cookies
          const cookieHeader = request.headers['cookie']
          if (cookieHeader) {
            const userId = extractUserIdFromCookie(cookieHeader)
            if (userId) {
              return {
                'callmiracle.user_id': userId
              }
            }
          }
          return {}
        },
        // requestHook is called after sampling decision is made (so not helpful for injecting user id)
        // requestHook: (span: any, request: any) => {},
        applyCustomAttributesOnSpan: (span: any, request: any, response: any) => {
          if (request.url) {
            span.updateName(createMiddlewareSpanName(request))
            const headers = response.getHeaders()
            if (headers) {
              addTraceAttribute('user-agent', 'http.user_agent', headers, span)
              addTraceAttribute('x-request-id', 'callmiracle.request_id', headers, span)
              addTraceAttribute('x-request-path', 'callmiracle.request_path', headers, span)
              addTraceAttribute('x-request-ip', 'callmiracle.client_ip', headers, span)
              addTraceAttribute('x-user-id', 'callmiracle.user_id', headers, span)
              addTraceAttribute('x-user-name', 'callmiracle.user_name', headers, span)
              // Note: x-user-instrumentation-config header is available but not recorded in spans to avoid data bloat
            }
          }
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