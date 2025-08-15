# Observability and Monitoring

## Overview

CallMiracle implements comprehensive observability using the **OpenTelemetry** standard with a complete monitoring stack including distributed tracing, structured logging, and metrics collection. The system provides full visibility into application performance, user interactions, and system health.

## Observability Stack Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │  OTEL Collector │    │     Storage     │
│   (Next.js)     │───→│   (Pipeline)    │───→│   & Analysis    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Instrumentation│    │   Processing    │    │  Visualization  │
│   - Traces      │    │   - Batching    │    │   - Grafana     │
│   - Logs        │    │   - Filtering   │    │   - Dashboards  │
│   - Metrics     │    │   - Enrichment  │    │   - Alerting    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Stack Components

1. **OpenTelemetry Instrumentation** - Application telemetry collection
2. **OTEL Collector** - Telemetry processing and routing
3. **Tempo** - Distributed tracing backend
4. **Loki** - Log aggregation and storage
5. **Grafana** - Visualization and dashboards
6. **Promtail** - Log shipping agent

## OpenTelemetry Implementation

### Instrumentation Setup
**File**: `src/instrumentation.ts`

```typescript
export async function register() {
  console.log('🚀 Starting CallMiracle application...')
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🆔 Server ID: ${process.env.SERVER_ID || 'unknown'}`)

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./instrumentation-edge')
  }
}
```

### Node.js Instrumentation
**File**: `src/instrumentation.node.ts`

**Key Features**:
- **Automatic Instrumentation**: HTTP, GraphQL, MongoDB, Express
- **Custom Spans**: User-aware span processing
- **Resource Detection**: Service name, version, environment
- **Export Configuration**: OTLP to collector

```typescript
// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [SEMATTRS_SERVICE_NAME]: 'callmiracle',
    [SEMATTRS_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    [SEMATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
  }),
  
  // Automatic instrumentation
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-graphql': { enabled: true }
    })
  ],
  
  // Span processors with user-aware sampling
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces'
      })
    ),
    new BatchSpanProcessor(new UserAwareSpanProcessor())
  ]
})
```

### User-Aware Tracing
**File**: `src/instrumentation/user-sampler.ts`

**Purpose**: Intelligent sampling based on user context and operation importance

```typescript
class UserAwareSampler implements Sampler {
  shouldSample(context: Context, traceId: string, spanName: string, spanKind: SpanKind, attributes: SpanAttributes): SamplingResult {
    // High-priority operations (always trace)
    if (this.isHighPriorityOperation(spanName, attributes)) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED }
    }
    
    // User-specific sampling
    const userId = attributes['user.id'] as string
    if (userId && this.shouldSampleUser(userId)) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED }
    }
    
    // Default sampling rate
    return this.parentBasedSampler.shouldSample(context, traceId, spanName, spanKind, attributes)
  }
  
  private isHighPriorityOperation(spanName: string, attributes: SpanAttributes): boolean {
    return (
      spanName.includes('callUser') ||           // WebRTC signaling
      spanName.includes('auth') ||               // Authentication
      attributes['graphql.operation.type'] === 'subscription' || // Real-time events
      (attributes['http.status_code'] as number) >= 400 // Errors
    )
  }
}
```

## Logging System

### Winston Logger Configuration
**File**: `src/utils/logger.ts`

**Features**:
- **Structured Logging**: JSON format with consistent fields
- **Multiple Transports**: Console, file rotation, Loki
- **Request Context**: Automatic request correlation
- **Log Levels**: Configurable per-user log levels

```typescript
const createLogger = () => {
  const transports: winston.transport[] = [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File rotation for persistence
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      format: winston.format.json()
    }),
    
    // Loki transport for centralized logging
    new LokiTransport({
      host: process.env.LOKI_HOST || 'http://localhost:3100',
      labels: {
        app: 'callmiracle',
        environment: process.env.NODE_ENV || 'development'
      }
    })
  ]
  
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports
  })
}
```

### Request Context Logging
**File**: `src/utils/requestContext.ts`

**Purpose**: Maintain request correlation and user context across async operations

```typescript
export const requestContext = new AsyncLocalStorage<RequestContext>()

interface RequestContext {
  requestId: string
  userId?: string
  sessionId?: string
  userAgent?: string
  ip?: string
  startTime: number
}

// Middleware to establish request context
export function withRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn)
}

// Get current request context
export function getCurrentContext(): RequestContext | undefined {
  return requestContext.getStore()
}
```

### Enhanced GraphQL Logging
**File**: `src/app/api/graphql/route.ts`

**Features**:
- **Operation Tracking**: Log all GraphQL operations with context
- **Error Handling**: Structured error logging with operation details
- **Performance Monitoring**: Request duration and complexity tracking

```typescript
export const POST = async (request: Request) => {
  const logger = await getLogger()
  
  // Log request with operation details
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const clone = request.clone()
      const body = await clone.json()
      const operationName = body.operationName || 'unnamed'
      
      logger.info('GraphQL Request: ' + operationName, {
        operationName,
        queryPreview: body.query?.substring(0, 100),
        variables: body.variables ? Object.keys(body.variables) : []
      })
    } catch (e) {
      logger.warn('Failed to parse GraphQL request body', {
        contentType: request.headers.get('content-type'),
        error: e instanceof Error ? e.message : String(e)
      })
    }
  }
  
  try {
    const response = await yoga.fetch(request)
    return await handleGraphQLResponse(response, request, logger, 'POST')
  } catch (error) {
    logger.error('GraphQL POST handler error', {
      operationName: await getOperationName(request),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}
```

## Distributed Tracing

### Trace Collection Pipeline
**File**: `observability/otel-collector/config.yaml`

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024
  
  memory_limiter:
    limit_mib: 400
    check_interval: 1s
  
  resource:
    attributes:
      - key: environment
        value: development
        action: upsert
      - key: service.name
        value: callmiracle
        action: upsert

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, resource, batch]
      exporters: [otlp/tempo]
```

### Custom Span Processing
**File**: `src/instrumentation/user-cache.ts`

**Purpose**: Cache user information for efficient trace enrichment

```typescript
class UserCache {
  private cache = new Map<string, { user: any; expiry: number }>()
  private readonly TTL = 5 * 60 * 1000 // 5 minutes
  
  async getUser(userId: string): Promise<any | null> {
    const cached = this.cache.get(userId)
    if (cached && cached.expiry > Date.now()) {
      return cached.user
    }
    
    // Fetch user from database
    const user = await this.fetchUserFromDatabase(userId)
    if (user) {
      this.cache.set(userId, {
        user,
        expiry: Date.now() + this.TTL
      })
    }
    
    return user
  }
}
```

## Log Aggregation

### Loki Configuration
**File**: `observability/loki/loki.yaml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

schema_config:
  configs:
    - from: 2020-10-24
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
```

### Promtail Log Shipping
**File**: `observability/promtail/promtail.yaml`

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: callmiracle-logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: callmiracle
          __path__: /app/logs/*.log
    
    pipeline_stages:
      - json:
          expressions:
            timestamp: timestamp
            level: level
            message: message
            userId: userId
      
      - timestamp:
          source: timestamp
          format: RFC3339
      
      - labels:
          level:
          userId:
```

## Monitoring Dashboards

### Grafana Dashboard Configuration
**File**: `observability/grafana/dashboards/callmiracle-overview.json`

**Key Panels**:
- **Request Rate**: Requests per second by endpoint
- **Response Time**: P50, P95, P99 latencies
- **Error Rate**: Error percentage by operation
- **WebRTC Metrics**: Call success rate, connection duration
- **User Activity**: Active users, session duration
- **System Health**: Memory usage, CPU utilization

### Dashboard Structure
```json
{
  "dashboard": {
    "title": "CallMiracle Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "WebRTC Call Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(webrtc_calls_successful_total[5m]) / rate(webrtc_calls_total[5m]) * 100"
          }
        ]
      }
    ]
  }
}
```

## Performance Monitoring

### Custom Metrics Collection
**File**: `src/utils/tracing.ts`

```typescript
// Custom metrics for application-specific monitoring
const meter = otel.metrics.getMeter('callmiracle')

const httpRequestDuration = meter.createHistogram('http_request_duration_ms', {
  description: 'Duration of HTTP requests in milliseconds'
})

const webrtcCallsTotal = meter.createCounter('webrtc_calls_total', {
  description: 'Total number of WebRTC calls initiated'
})

const activeUsers = meter.createUpDownCounter('active_users', {
  description: 'Number of currently active users'
})

// Usage in application code
export function recordHttpRequest(duration: number, method: string, status: number) {
  httpRequestDuration.record(duration, {
    method,
    status_code: status.toString()
  })
}

export function recordWebRTCCall(success: boolean, duration?: number) {
  webrtcCallsTotal.add(1, {
    success: success.toString(),
    duration_bucket: duration ? getBucket(duration) : 'unknown'
  })
}
```

### Request Tracing Middleware
**File**: `src/middleware.ts`

```typescript
export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  
  // Establish request context
  const context: RequestContext = {
    requestId,
    startTime,
    userAgent: request.headers.get('user-agent') || 'unknown',
    ip: getClientIP(request)
  }
  
  return withRequestContext(context, async () => {
    const response = await NextResponse.next()
    
    // Record request metrics
    const duration = Date.now() - startTime
    recordHttpRequest(duration, request.method, response.status)
    
    // Add correlation headers
    response.headers.set('x-request-id', requestId)
    
    return response
  })
}
```

## User-Specific Observability

### Configurable Instrumentation
**File**: `src/utils/user-instrumentation.ts`

**Features**:
- **Per-User Sampling**: Different sampling rates per user
- **Dynamic Configuration**: Runtime configuration changes
- **User Privacy**: Respect user privacy settings

```typescript
interface InstrumentationConfig {
  samplingRate: number
  enableTracing: boolean
  enableMetrics: boolean
  verbosityLevel: 'MINIMAL' | 'STANDARD' | 'DETAILED'
  instrumentations: {
    http: boolean
    graphql: boolean
    mongodb: boolean
    webrtc: boolean
  }
}

class UserInstrumentationManager {
  async getConfigForUser(userId: string): Promise<InstrumentationConfig> {
    const user = await this.userCache.getUser(userId)
    return user?.instrumentationConfig || this.defaultConfig
  }
  
  shouldSampleForUser(userId: string, operationType: string): boolean {
    const config = await this.getConfigForUser(userId)
    
    if (!config.enableTracing) return false
    
    // High-priority operations always sampled
    if (this.isHighPriorityOperation(operationType)) {
      return true
    }
    
    return Math.random() < config.samplingRate
  }
}
```

## Deployment and Operations

### Docker Compose Setup
**File**: `docker-compose.observability.yml`

```yaml
version: '3.8'
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./observability/otel-collector/config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"   # OTLP gRPC receiver
      - "4318:4318"   # OTLP HTTP receiver
    depends_on:
      - tempo
      - loki

  tempo:
    image: grafana/tempo:latest
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./observability/tempo/tempo.yaml:/etc/tempo.yaml
    ports:
      - "3200:3200"

  loki:
    image: grafana/loki:latest
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./observability/loki/loki.yaml:/etc/loki/local-config.yaml
    ports:
      - "3100:3100"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./observability/grafana/provisioning:/etc/grafana/provisioning
      - ./observability/grafana/dashboards:/var/lib/grafana/dashboards
```

### Management Scripts
```bash
# Start observability stack
yarn observability:up

# View logs from all services
yarn observability:logs

# Restart specific service
docker-compose -f docker-compose.observability.yml restart grafana

# Access Grafana
open http://localhost:3001

# Access trace search (Tempo via Grafana)
# Grafana -> Explore -> Tempo -> Search traces
```

## Troubleshooting and Debugging

### Common Issues
1. **Missing Traces**: Check OTEL collector connectivity and configuration
2. **High Memory Usage**: Adjust batch processor settings
3. **Sampling Issues**: Verify user-aware sampler configuration
4. **Log Shipping**: Check Promtail configuration and file permissions

### Debug Tools
- **OTEL Collector Metrics**: Available at `:8888/metrics`
- **Health Checks**: Available at `:13133`
- **Grafana Explore**: Interactive querying interface
- **Log Correlation**: Use request ID to correlate logs and traces

This comprehensive observability setup provides deep insights into application behavior, user interactions, and system performance while maintaining user privacy and system efficiency.