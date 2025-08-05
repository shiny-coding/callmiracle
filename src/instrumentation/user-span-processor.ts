import { BatchSpanProcessor, BatchSpanProcessorConfig } from '@opentelemetry/sdk-trace-node'
import { ReadableSpan, Span, SpanExporter } from '@opentelemetry/sdk-trace-base'
import { Context } from '@opentelemetry/api'
import { getUserInstrumentationConfig, getCurrentUserId, UserInstrumentationConfig } from '@/utils/user-instrumentation'

interface UserAwareSpanProcessorConfig extends BatchSpanProcessorConfig {
  // Additional config options for user-aware processing
  enableUserSampling?: boolean
  fallbackSamplingRate?: number
}

export class UserAwareSpanProcessor extends BatchSpanProcessor {
  private readonly enableUserSampling: boolean
  private readonly fallbackSamplingRate: number
  private readonly userConfigCache = new Map<string, { config: UserInstrumentationConfig; timestamp: number }>()
  private readonly CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes - shorter than main cache

  constructor(exporter: SpanExporter, config: UserAwareSpanProcessorConfig = {}) {
    super(exporter, config)
    this.enableUserSampling = config.enableUserSampling ?? true
    this.fallbackSamplingRate = config.fallbackSamplingRate ?? 0.1
  }

  /**
   * Called when a span is started - decide if we should process it
   */
  onStart(span: Span, parentContext: Context): void {
    if (!this.enableUserSampling) {
      super.onStart(span, parentContext)
      return
    }

    // Set up async sampling decision
    this.applySamplingDecision(span).catch(error => {
      console.error('Error in user-aware sampling:', error)
      // Fall back to default behavior on error
      super.onStart(span, parentContext)
    })
  }

  /**
   * Apply sampling decision based on user configuration
   */
  private async applySamplingDecision(span: Span): Promise<void> {
    try {
      const userId = await this.getUserIdFromSpan(span)
      
      if (!userId) {
        // No user context - use fallback sampling
        if (Math.random() >= this.fallbackSamplingRate) {
          span.end()
          return
        }
        super.onStart(span, Context.active())
        return
      }

      const config = await this.getUserConfig(userId)
      
      // Check if tracing is enabled for this user
      if (!config.enableTracing) {
        span.end()
        return
      }

      // Check instrumentation type specific rules
      const spanName = span.name.toLowerCase()
      if (!this.isInstrumentationAllowed(spanName, config)) {
        span.end()
        return
      }

      // Apply sampling rules
      if (!this.shouldSampleSpan(span, config)) {
        span.end()
        return
      }

      // Span passed all checks - process it normally
      super.onStart(span, Context.active())

      // Add user context attributes
      span.setAttributes({
        'callmiracle.user_sampling_rate': config.samplingRate,
        'callmiracle.user_verbosity': config.verbosityLevel,
        'callmiracle.instrumentation_version': '1.0.0'
      })

    } catch (error) {
      console.error('Error in sampling decision:', error)
      // Default to processing the span on error
      super.onStart(span, Context.active())
    }
  }

  /**
   * Get user ID from span attributes or context
   */
  private async getUserIdFromSpan(span: Span): Promise<string | null> {
    // Try to get from span attributes first
    const userIdAttr = span.attributes['callmiracle.user_id'] as string
    if (userIdAttr && userIdAttr !== 'anonymous') {
      return userIdAttr
    }

    // Fall back to getCurrentUserId
    return await getCurrentUserId()
  }

  /**
   * Get user configuration with local caching
   */
  private async getUserConfig(userId: string): Promise<UserInstrumentationConfig> {
    // Check local cache first
    const cached = this.userConfigCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.config
    }

    // Fetch from main utility (which has its own cache)
    const config = await getUserInstrumentationConfig(userId)
    
    // Update local cache
    this.userConfigCache.set(userId, { config, timestamp: Date.now() })
    
    return config
  }

  /**
   * Check if instrumentation type is allowed based on span name
   */
  private isInstrumentationAllowed(spanName: string, config: UserInstrumentationConfig): boolean {
    // HTTP spans
    if (spanName.includes('http') || spanName.includes('request') || spanName.includes('response')) {
      return config.instrumentations.http
    }

    // GraphQL spans
    if (spanName.includes('graphql') || spanName.includes('query') || spanName.includes('mutation') || spanName.includes('subscription')) {
      return config.instrumentations.graphql
    }

    // MongoDB spans
    if (spanName.includes('mongodb') || spanName.includes('mongo') || spanName.includes('collection')) {
      return config.instrumentations.mongodb
    }

    // WebRTC spans (custom spans we might add)
    if (spanName.includes('webrtc') || spanName.includes('rtc') || spanName.includes('peer')) {
      return config.instrumentations.webrtc
    }

    // Default to allowing unknown span types
    return true
  }

  /**
   * Determine if span should be sampled based on user config and span characteristics
   */
  private shouldSampleSpan(span: Span, config: UserInstrumentationConfig): boolean {
    const attributes = span.attributes

    // Always sample errors
    const statusCode = attributes['http.status_code'] as number
    if (statusCode && statusCode >= 400) {
      return true
    }

    // Always sample slow operations
    const duration = attributes['http.request.duration'] as number
    if (duration && duration > 2000) {
      return true
    }

    // For GraphQL operations, check if it's a critical operation
    const operationType = attributes['graphql.operation.type'] as string
    if (operationType === 'mutation') {
      // Always sample mutations as they're more critical
      return true
    }

    // Apply user-specific sampling rate
    return Math.random() < config.samplingRate
  }

  /**
   * Called when span ends - allow additional processing based on user config
   */
  onEnd(span: ReadableSpan): void {
    // Add additional attributes based on user verbosity level
    this.enrichSpanBasedOnVerbosity(span).catch(error => {
      console.error('Error enriching span:', error)
    }).finally(() => {
      super.onEnd(span)
    })
  }

  /**
   * Enrich span with additional data based on user's verbosity level
   */
  private async enrichSpanBasedOnVerbosity(span: ReadableSpan): Promise<void> {
    try {
      const userId = await this.getUserIdFromSpan(span as any)
      if (!userId) return

      const config = await this.getUserConfig(userId)

      if (config.verbosityLevel === 'DETAILED') {
        // Add detailed timing and context information
        const now = Date.now()
        span.attributes['callmiracle.processing_timestamp'] = now
        span.attributes['callmiracle.verbosity_level'] = 'detailed'
        
        // Add memory usage if available
        if (process.memoryUsage) {
          const memory = process.memoryUsage()
          span.attributes['callmiracle.memory_used_mb'] = Math.round(memory.heapUsed / 1024 / 1024)
        }
      } else if (config.verbosityLevel === 'MINIMAL') {
        // For minimal verbosity, remove some default attributes to reduce size
        delete span.attributes['http.user_agent']
        delete span.attributes['http.request.body.size']
        delete span.attributes['http.response.body.size']
      }

    } catch (error) {
      console.error('Error in span enrichment:', error)
    }
  }

  /**
   * Shutdown with cleanup
   */
  async shutdown(): Promise<void> {
    this.userConfigCache.clear()
    return super.shutdown()
  }

  /**
   * Get processor statistics for monitoring
   */
  getStats() {
    return {
      enableUserSampling: this.enableUserSampling,
      fallbackSamplingRate: this.fallbackSamplingRate,
      cachedConfigs: this.userConfigCache.size,
      cacheEntries: Array.from(this.userConfigCache.entries()).map(([userId, data]) => ({
        userId,
        verbosity: data.config.verbosityLevel,
        samplingRate: data.config.samplingRate,
        age: Date.now() - data.timestamp
      }))
    }
  }
}