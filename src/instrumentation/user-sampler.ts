import { Context, SpanKind, Attributes, Link } from '@opentelemetry/api'
import { Sampler, SamplingResult, SamplingDecision } from '@opentelemetry/sdk-trace-base'
import { getUserInstrumentationConfigSync } from '@/utils/user-instrumentation'
import { decode } from 'next-auth/jwt'

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
    
    const url = attributes['http.url'] as string
    if (!url) return { decision: SamplingDecision.NOT_RECORD }

    const userId = this.extractUserIdFromCookies(attributes)
    
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

  private extractUserIdFromCookies(attributes: Attributes): string | null {
    try {
      const cookieHeader = attributes['http.request.header.cookie'] as string
      if (!cookieHeader) return null

      // Parse NextAuth session token
      const cookies = this.parseCookies(cookieHeader)
      const sessionToken = cookies['next-auth.session-token'] || cookies['__Secure-next-auth.session-token']
      
      if (!sessionToken) return null

      // Decode NextAuth JWT token synchronously (this is a simplified version)
      // In production, you might want to cache decoded tokens
      const secret = process.env.NEXTAUTH_SECRET
      if (!secret) return null

      // Note: This is a synchronous decode attempt - may not work with all tokens
      // You might need to implement a simple JWT decode for the user ID claim
      return this.extractUserIdFromJWT(sessionToken)
    } catch (error) {
      // Silently fail and use fallback sampling
      return null
    }
  }

  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {}
    cookieHeader.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=')
      if (key && value) {
        cookies[key] = decodeURIComponent(value)
      }
    })
    return cookies
  }

  private extractUserIdFromJWT(token: string): string | null {
    try {
      // Simple JWT decode (without verification for performance)
      const parts = token.split('.')
      if (parts.length !== 3) return null
      
      const payload = Buffer.from(parts[1], 'base64').toString('utf-8')
      const data = JSON.parse(payload)
      
      return data.sub || data.id || null
    } catch {
      return null
    }
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