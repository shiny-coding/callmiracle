import { trace, context as otelContext } from '@opentelemetry/api'

/**
 * Adds custom attributes to the current active span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>) {
  const span = trace.getActiveSpan()
  if (span) {
    span.setAttributes(attributes)
  }
}

/**
 * Adds request context attributes to the current span
 */
export function addRequestContextToSpan(requestContext: {
  requestId?: string
  path?: string
  method?: string
  userAgent?: string
  ip?: string
  userId?: string
  userName?: string
}) {
  const attributes: Record<string, string> = {}
  
  if (requestContext.requestId) attributes['callmiracle.request_id'] = requestContext.requestId
  if (requestContext.path) attributes['callmiracle.request_path'] = requestContext.path
  if (requestContext.method) attributes['callmiracle.request_method'] = requestContext.method
  if (requestContext.userAgent) attributes['callmiracle.user_agent'] = requestContext.userAgent
  if (requestContext.ip) attributes['callmiracle.client_ip'] = requestContext.ip
  if (requestContext.userId && requestContext.userId !== 'anonymous') {
    attributes['callmiracle.user_id'] = requestContext.userId
  }
  if (requestContext.userName && requestContext.userName !== 'anonymous') {
    attributes['callmiracle.user_name'] = requestContext.userName
  }
  
  addSpanAttributes(attributes)
}

/**
 * Adds GraphQL operation name to the current span
 */
export function addGraphQLOperationToSpan(operationName: string) {
  addSpanAttributes({
    'graphql.operation_name': operationName
  })
}

/**
 * Creates a new span with custom attributes
 */
export function createSpanWithAttributes(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<any>
) {
  const tracer = trace.getTracer('callmiracle')
  
  return tracer.startActiveSpan(name, async (span) => {
    try {
      span.setAttributes(attributes)
      const result = await fn()
      span.setStatus({ code: 1 }) // OK
      return result
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Gets the current trace ID for logging correlation
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan()
  return span?.spanContext().traceId
}

/**
 * Gets the current span ID for logging correlation
 */
export function getCurrentSpanId(): string | undefined {
  const span = trace.getActiveSpan()
  return span?.spanContext().spanId
}