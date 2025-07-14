# CallMiracle Observability Stack

This document explains the observability setup for the CallMiracle application, which includes distributed tracing, log aggregation, and monitoring using OpenTelemetry, Grafana, Tempo, and Loki.

## 🚀 Quick Start

### 1. Start the Observability Stack

```bash
# Using the convenience script
./scripts/start-observability.sh

# Or manually
yarn observability:up
```

### 2. Start Your Application with Observability

```bash
# Development with observability enabled
yarn dev:observability

# Or with environment variables
ENABLE_LOKI=true yarn dev
```

### 3. Access the Services

- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
- **Loki (Logs)**: http://localhost:3100
- **Tempo (Traces)**: http://localhost:3200
- **OTEL Collector**: http://localhost:4318

## 📊 Components Overview

### OpenTelemetry (OTEL)
- **Purpose**: Automatic instrumentation for traces, metrics, and logs
- **Configuration**: `src/instrumentation.ts`
- **Endpoint**: http://localhost:4318

### Grafana
- **Purpose**: Visualization and dashboards
- **Port**: 3001
- **Default Login**: admin/admin
- **Dashboards**: Pre-configured CallMiracle dashboard

### Tempo
- **Purpose**: Distributed tracing backend
- **Port**: 3200
- **Features**: Trace storage, querying, and correlation

### Loki
- **Purpose**: Log aggregation and querying
- **Port**: 3100
- **Integration**: Winston logs automatically sent to Loki

### Promtail
- **Purpose**: Log collection from files
- **Reads**: `./logs/*.log` files
- **Sends to**: Loki

### OTEL Collector
- **Purpose**: Telemetry collection and processing
- **Ports**: 4317 (gRPC), 4318 (HTTP)
- **Routes**: Traces to Tempo, Logs to Loki

## 🔧 Configuration

### Environment Variables

```env
# OpenTelemetry Configuration
OTEL_SERVICE_NAME=callmiracle
OTEL_SERVICE_VERSION=1.0.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Loki Configuration
ENABLE_LOKI=true
LOKI_HOST=http://localhost:3100

# Log Configuration
LOG_DIR=logs
LOG_LEVEL=info
```

### Winston-Loki Integration

The logger automatically sends logs to Loki when `ENABLE_LOKI=true` or in production:

```typescript
import { getLogger } from '@/utils/logger'

const logger = await getLogger()
logger.info('This will appear in Loki and Grafana')
```

### Trace Correlation

Logs automatically include trace IDs for correlation:

```typescript
import { addTraceToLog } from '@/utils/logger'

logger.info('User action', addTraceToLog({ userId, action: 'login' }))
```

## 📈 Dashboards and Queries

### Pre-configured Dashboard
- Application logs by level
- Error tracking
- API request monitoring
- Distributed traces visualization

### Useful Loki Queries

```logql
# All application logs
{service="callmiracle"}

# Error logs only
{service="callmiracle", level="error"}

# Logs for specific user
{service="callmiracle"} |= "user:john"

# API request logs
{service="callmiracle"} |= "API"

# Logs with trace correlation
{service="callmiracle"} | json | traceId != ""
```

### Useful Tempo Queries

```
# Find traces by service
service.name="callmiracle"

# Find slow traces
duration > 1s

# Find traces with errors
status=error
```

## 🛠 Management Commands

```bash
# Start observability stack
yarn observability:up

# Stop observability stack
yarn observability:down

# View observability logs
yarn observability:logs

# Restart observability stack
yarn observability:restart

# Start app with Docker (includes observability)
yarn docker:up

# View app logs in Docker
yarn docker:logs
```

## 🔍 Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   # Check Docker status
   docker ps
   
   # View service logs
   yarn observability:logs
   ```

2. **Loki connection errors**
   ```bash
   # Check Loki is running
   curl http://localhost:3100/ready
   
   # Check Loki logs
   docker logs callmiracle-loki
   ```

3. **No traces appearing**
   - Check OTEL Collector logs: `docker logs callmiracle-otel-collector`
   - Verify Tempo is receiving data: `curl http://localhost:3200/ready`

4. **Grafana dashboard empty**
   - Check datasource connections in Grafana
   - Verify logs are being sent to Loki
   - Check if traces are being sent to Tempo

### Log Levels

The application respects user-specific log levels:
- `error`: Only errors
- `warn`: Warnings and errors
- `info`: Info, warnings, and errors (default)
- `debug`: All logs

### Performance Considerations

- **Production**: Loki is enabled by default
- **Development**: Enable with `ENABLE_LOKI=true`
- **File Rotation**: Logs rotate daily, kept for 14 days
- **Memory**: OTEL Collector limited to 400MB

## 🔗 Integration Points

### Automatic Instrumentation
- HTTP requests
- GraphQL operations
- MongoDB queries
- Express middleware
- Next.js API routes

### Manual Instrumentation

```typescript
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('callmiracle')

// Create custom spans
const span = tracer.startSpan('custom-operation')
try {
  // Your code here
  span.setAttributes({ userId, operation: 'custom' })
} finally {
  span.end()
}
```

### Log Correlation

```typescript
// Logs automatically include trace information
const logger = await getLogger()
logger.info('Processing request', { 
  userId, 
  requestId, 
  // traceId is automatically added
})
```

## 📚 Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Tempo Documentation](https://grafana.com/docs/tempo/)
- [Winston Documentation](https://github.com/winstonjs/winston)

## 🤝 Contributing

When adding new features:
1. Add appropriate OpenTelemetry spans for new operations
2. Include relevant metadata in logs
3. Update dashboard queries if needed
4. Test observability in development environment

---

For more information about the CallMiracle application, see the main [README.md](./README.md). 