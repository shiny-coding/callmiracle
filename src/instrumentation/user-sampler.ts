import { Context, SpanKind, Attributes, Link, context as otelContext } from '@opentelemetry/api'
import { Sampler, SamplingResult, SamplingDecision } from '@opentelemetry/sdk-trace-base'
import { getUserInstrumentationConfigSync } from '@/utils/user-instrumentation'
import { USER_ID_CONTEXT_KEY } from './context-keys'
import { shouldSamplePath } from '@/utils/middleware-tracing'

interface UserSamplerConfig {
  fallbackSamplingRate?: number
}

export class UserSampler implements Sampler {
  private readonly fallbackSamplingRate: number

  constructor(config: UserSamplerConfig = {}) {
    this.fallbackSamplingRate = config.fallbackSamplingRate ?? 0.1
  }

  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[]
  ): SamplingResult {
    
    // Check if this is an HTTP span
    const url = attributes['http.target'] as string
    if ( !url ) return { decision: SamplingDecision.NOT_RECORD }
    if ( !shouldSamplePath(url) ) return { decision: SamplingDecision.NOT_RECORD }

    return { decision: SamplingDecision.RECORD_AND_SAMPLED }

    // Get user ID from attributes (available for HTTP spans from startIncomingSpanHook)
    const userId = attributes['callmiracle.user_id'] as string

    if (!userId || userId === 'anonymous') {
      // No user context - use fallback sampling
      return this.traceBasedSampling(traceId, this.fallbackSamplingRate)
    }

    // Get user config from cache
    const config = getUserInstrumentationConfigSync(userId)
    
    // Check if tracing is disabled
    if (!config.enableTracing) {
      return { decision: SamplingDecision.NOT_RECORD }
    }

    // Check instrumentation type
    if (!this.isInstrumentationAllowed(spanName, config)) {
      return { decision: SamplingDecision.NOT_RECORD }
    }

    // Always sample errors, slow ops, mutations
    const statusCode = attributes['http.status_code'] as number
    const duration = attributes['http.request.duration'] as number
    const operationType = attributes['graphql.operation.type'] as string
    
    if ((statusCode && statusCode >= 400) || 
        (duration && duration > 2000) || 
        operationType === 'mutation') {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED }
    }

    // Use user's sampling rate
    return this.traceBasedSampling(traceId, config.samplingRate)
  }

  private traceBasedSampling(traceId: string, samplingRate: number): SamplingResult {
    if (samplingRate >= 1.0) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED }
    }
    
    if (samplingRate <= 0.0) {
      return { decision: SamplingDecision.NOT_RECORD }
    }

    // Deterministic sampling based on trace ID
    const traceIdSuffix = traceId.slice(-8)
    const threshold = Math.floor(samplingRate * 0xffffffff)
    const traceIdInt = parseInt(traceIdSuffix, 16)
    
    return traceIdInt <= threshold 
      ? { decision: SamplingDecision.RECORD_AND_SAMPLED }
      : { decision: SamplingDecision.NOT_RECORD }
  }


  private isInstrumentationAllowed(spanName: string, config: any): boolean {
    const name = spanName.toLowerCase()

    if (name.includes('http') || name.includes('request')) return config.instrumentations.http
    if (name.includes('graphql') || name.includes('query')) return config.instrumentations.graphql
    if (name.includes('mongo')) return config.instrumentations.mongodb
    if (name.includes('webrtc') || name.includes('rtc')) return config.instrumentations.webrtc

    return true
  }

  toString(): string {
    return `UserSampler{fallbackRate=${this.fallbackSamplingRate}}`
  }
}