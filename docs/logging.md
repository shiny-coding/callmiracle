# Logging System Documentation

This document describes the comprehensive logging system implemented in the CallMiracle application.

## Overview

The logging system provides:
- **Structured logging** with Winston
- **Log rotation** with daily files
- **Client-side error tracking**
- **Optional Elasticsearch/Kibana integration**
- **Request/response logging**
- **Error handling and performance monitoring**

## Components

### 1. Server-side Logger (`src/utils/logger.ts`)

The main logger uses Winston with multiple transports:

```typescript
import logger, { withContext, withRequest } from '@/utils/logger'

// Basic logging
logger.info('Something happened', { userId: '123', action: 'user_login' })
logger.error('Error occurred', { error: error.message, stack: error.stack })

// With context
const contextLogger = withContext({ requestId: 'req-123', userId: 'user-456' })
contextLogger.info('User action performed')

// With request context (automatically extracts info from request)
const requestLogger = withRequest(req)
requestLogger.info('Processing request')
```

### 2. Client-side Logger (`src/utils/clientLogger.ts`)

```typescript
import clientLogger from '@/utils/clientLogger'

// These are sent to server automatically
clientLogger.error('Client error occurred', { component: 'UserProfile' })
clientLogger.warn('Performance warning', { loadTime: 3000 })

// Development only (unless NEXT_PUBLIC_CLIENT_LOGGING=true)
clientLogger.info('User clicked button', { buttonId: 'submit' })
clientLogger.debug('Debug information')

// Specialized logging methods
clientLogger.userAction('clicked_submit_button', { formId: 'profile' })
clientLogger.apiCall('POST', '/api/users', 200, 150)
clientLogger.performance('page_load', 2500)
```

### 3. Error Handling (`src/utils/error.ts`)

```typescript
import { AppError, ValidationError, handleError } from '@/utils/error'

// Custom errors
throw new ValidationError('Email is required')
throw new AuthenticationError()
throw new NotFoundError('User')

// Error handling
try {
  // ... some operation
} catch (error) {
  const errorResponse = handleError(error, req)
  res.status(errorResponse.statusCode).json(errorResponse)
}
```

### 4. Request Logging Middleware (`src/middleware/requestLogger.ts`)

```typescript
import { withRequestLogging } from '@/middleware/requestLogger'

// Wrap API routes
export default withRequestLogging(async (req, res) => {
  // Your API logic here
  res.json({ success: true })
})
```

## Configuration

### Environment Variables

```bash
# Logging Configuration
LOG_LEVEL=info                    # debug, info, warn, error
LOG_DIR=logs                      # Directory for log files
LOG_RESPONSE_BODY=false          # Log response bodies (debugging)

# Client logging (send all client logs to server)
NEXT_PUBLIC_CLIENT_LOGGING=false

# Optional Elasticsearch Integration
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
ELASTICSEARCH_INDEX_PREFIX=callmiracle
```

### Log Rotation

Logs are automatically rotated daily:
- **Application logs**: `logs/application-YYYY-MM-DD.log` (14 days retention)
- **Error logs**: `logs/error-YYYY-MM-DD.log` (30 days retention)
- **Exceptions**: `logs/exceptions-YYYY-MM-DD.log` (30 days retention)
- **Rejections**: `logs/rejections-YYYY-MM-DD.log` (30 days retention)

Files are compressed after rotation to save space.

## Log Formats

### Console Output (Development)
```
2024-01-15 10:30:45 [INFO] [callmiracle] [req-123] [user:456] [/api/users]: User login successful {"method":"POST","status":200}
```

### File Output (JSON)
```json
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "info",
  "message": "User login successful",
  "service": "callmiracle",
  "requestId": "req-123",
  "userId": "456",
  "path": "/api/users",
  "method": "POST",
  "status": 200
}
```

## GraphQL Integration

The logger is available in GraphQL resolvers through the context:

```typescript
export const someResolver = async (_: any, args: any, { db, session, logger }: Context) => {
  logger.info('Resolver called', { resolver: 'someResolver', args })
  
  try {
    // ... resolver logic
    logger.info('Resolver completed successfully')
    return result
  } catch (error) {
    logger.error('Resolver failed', { error: error.message })
    throw error
  }
}
```

## Elasticsearch/Kibana Setup (Optional)

### 1. Start ELK Stack
```bash
docker-compose -f docker-compose.logging.yml up -d
```

### 2. Enable Elasticsearch Logging
Add to `.env.local`:
```bash
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX_PREFIX=callmiracle
```

### 3. Access Kibana
- Open http://localhost:5601
- Create index pattern: `callmiracle-*`
- Start exploring your logs!

### 4. Create Kibana Dashboards

Useful visualizations:
- **Error Rate**: Count of error logs over time
- **Response Times**: Average API response times
- **User Activity**: Most active users and actions
- **Geographic Distribution**: User locations from IP addresses
- **Performance Metrics**: Slow queries and operations

## Best Practices

### 1. Log Levels
- **DEBUG**: Detailed information for debugging
- **INFO**: General application flow
- **WARN**: Something unexpected but recoverable
- **ERROR**: Error conditions that need attention

### 2. Structured Logging
Always include relevant context:
```typescript
logger.info('User updated profile', {
  userId: user.id,
  fieldsChanged: ['name', 'email'],
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
})
```

### 3. Sensitive Data
Never log passwords, tokens, or personal data:
```typescript
// ❌ Bad
logger.info('User login', { email, password })

// ✅ Good
logger.info('User login attempt', { email, success: true })
```

### 4. Performance Monitoring
Use the performance wrapper for slow operations:
```typescript
import { withPerformanceLogging } from '@/utils/error'

const slowOperation = withPerformanceLogging('database_query', async () => {
  return await db.collection('users').find({}).toArray()
})
```

## Monitoring and Alerts

### 1. Log Monitoring
Monitor these metrics:
- Error rate (errors per minute)
- Response time percentiles
- Failed authentication attempts
- Database connection errors

### 2. Disk Space
Monitor the `logs/` directory size and implement cleanup if needed:
```bash
# Clean logs older than 30 days
find logs/ -name "*.log*" -mtime +30 -delete
```

### 3. Elasticsearch Health
If using Elasticsearch, monitor:
- Cluster health
- Index size
- Query performance

## Troubleshooting

### Common Issues

1. **Logs not appearing**
   - Check `LOG_LEVEL` environment variable
   - Verify `logs/` directory permissions
   - Check console for Winston errors

2. **Large log files**
   - Reduce `LOG_LEVEL` to `warn` or `error`
   - Decrease retention period
   - Enable compression

3. **Elasticsearch connection errors**
   - Verify `ELASTICSEARCH_URL` is correct
   - Check if Elasticsearch is running
   - Verify network connectivity

4. **Missing request context**
   - Ensure middleware is properly applied
   - Check session configuration
   - Verify request ID generation

## Security Considerations

1. **Log File Access**: Restrict access to log files in production
2. **Sensitive Data**: Never log passwords, tokens, or personal information
3. **Log Retention**: Implement appropriate retention policies
4. **Elasticsearch Security**: Enable authentication for production use

## Example Usage

Here's a complete example of adding logging to a new API route:

```typescript
import { withRequestLogging } from '@/middleware/requestLogger'
import { handleError, ValidationError } from '@/utils/error'
import clientLogger from '@/utils/clientLogger'

export default withRequestLogging(async (req, res) => {
  const log = withRequest(req)
  
  try {
    log.info('Processing user creation request')
    
    if (!req.body.email) {
      throw new ValidationError('Email is required')
    }
    
    // ... business logic
    
    log.info('User created successfully', { userId: newUser.id })
    res.json({ success: true, userId: newUser.id })
    
  } catch (error) {
    const errorResponse = handleError(error, req)
    res.status(errorResponse.statusCode).json(errorResponse)
  }
})
```

This logging system provides comprehensive visibility into your application's behavior while maintaining performance and security. 