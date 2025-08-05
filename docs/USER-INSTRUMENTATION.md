# Per-User Instrumentation Configuration

This implementation provides fine-grained control over OpenTelemetry instrumentation on a per-user basis, allowing you to manage data volume and performance impact while maintaining observability.

## Architecture Overview

### Core Components

1. **User Schema Extensions** (`src/schema/schema.graphql`)
   - Added `instrumentationConfig` field to User type  
   - Defines instrumentation settings with presets and component toggles

2. **User-Aware Span Processor** (`src/instrumentation/user-span-processor.ts`)
   - Extends `BatchSpanProcessor` with user-specific sampling logic
   - Intelligent sampling based on user configuration and span characteristics
   - Caching for performance optimization

3. **Configuration Utilities** (`src/utils/user-instrumentation.ts`)
   - User config management with caching
   - Default and preset configurations
   - Context-aware user identification

4. **Admin Tools** (`src/utils/admin-instrumentation.ts`)
   - Bulk operations and preset management
   - Statistics and monitoring
   - High-volume user detection

## Configuration Levels

### Preset Configurations

**Minimal** (5% sampling)
- HTTP requests only
- Basic monitoring with minimal overhead
- ~50-100KB/user/hour

**Standard** (10% sampling) - Default
- HTTP + GraphQL operations
- Balanced observability and performance
- ~200-300KB/user/hour

**Detailed** (50% sampling)
- HTTP + GraphQL + MongoDB
- Comprehensive monitoring for power users
- ~500KB-1MB/user/hour

**Admin/Debug** (100% sampling)
- All instrumentations enabled
- Full observability for debugging
- ~2-5MB/user/hour

### Configuration Fields

```typescript
interface UserInstrumentationConfig {
  samplingRate: number         // 0.0-1.0
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
```

## Smart Sampling Logic

### Always Sampled
- HTTP errors (status >= 400)
- Slow requests (>2s duration)
- GraphQL mutations (higher criticality)

### User-Rate Sampling
- Normal operations use user's configured sampling rate
- Anonymous users default to 10% sampling

### Instrumentation Filtering
- Spans filtered by type based on user preferences
- WebRTC and MongoDB disabled by default (high volume)

## Management Tools

### API Endpoints

**Admin API** (`/api/admin/instrumentation`)
- `GET ?action=stats` - Overall statistics
- `GET ?action=high-volume-users` - Users with high instrumentation
- `POST action=apply-preset` - Apply preset to user
- `POST action=bulk-apply-preset` - Bulk operations
- `POST action=update-config` - Custom configuration
- `POST action=reset-config` - Reset to defaults

### Command Line Script

```bash
# View statistics
node scripts/manage-instrumentation.js stats

# Apply preset to specific user
node scripts/manage-instrumentation.js apply-preset user123 detailed

# Bulk apply to admin users
node scripts/manage-instrumentation.js bulk-apply admin admin-users

# Reset user to defaults
node scripts/manage-instrumentation.js reset user123

# Find high-volume users
node scripts/manage-instrumentation.js high-volume
```

## Database Operations

### Setting User Configuration

```javascript
// Via admin utilities
await applyInstrumentationPreset('user123', 'detailed')

// Direct database update
db.users.updateOne(
  { _id: 'user123' },
  { 
    $set: { 
      instrumentationConfig: {
        samplingRate: 0.5,
        enableTracing: true,
        enableMetrics: true,
        verbosityLevel: 'DETAILED',
        instrumentations: {
          http: true,
          graphql: true,
          mongodb: true,
          webrtc: false
        }
      }
    }
  }
)
```

### Querying High-Volume Users

```javascript
// Find users with high instrumentation
db.users.find({
  $or: [
    { 'instrumentationConfig.samplingRate': { $gte: 0.5 } },
    { 'instrumentationConfig.verbosityLevel': 'DETAILED' },
    { 'instrumentationConfig.instrumentations.webrtc': true }
  ]
})
```

## Performance Monitoring

### Data Volume Estimates

- **Minimal**: <200KB/user/hour
- **Standard**: 200-500KB/user/hour  
- **Detailed**: 500KB-1MB/user/hour
- **Admin/Debug**: 2-5MB/user/hour

### Cache Strategy

- **User configs**: 5-minute TTL with LRU eviction
- **Span processor**: 2-minute local cache for fast decisions
- **Admin operations**: Manual cache clearing after bulk updates

## Security Considerations

### Admin Access
- Admin endpoints require authentication
- Currently checks email patterns (`admin`, `dev`, `support`)
- Implement proper role-based access control

### Data Protection
- User configs stored in main user collection
- No sensitive data in instrumentation traces
- Automatic cache cleanup and expiration

## Operational Procedures

### Setting Up New Users
```bash
# Standard users get default config (no action needed)
# For power users who need detailed monitoring:
node scripts/manage-instrumentation.js apply-preset user123 detailed
```

### Managing High Data Volume
```bash
# Find users consuming high bandwidth
node scripts/manage-instrumentation.js high-volume

# Reduce sampling for specific users
curl -X POST /api/admin/instrumentation \
  -d '{"action":"update-config","userId":"user123","config":{"samplingRate":0.1}}'
```

### Emergency Data Reduction
```bash
# Reset all users to minimal preset
node scripts/manage-instrumentation.js bulk-apply minimal all-users

# Clear all caches
curl -X POST /api/admin/instrumentation -d '{"action":"clear-caches"}'
```

## Monitoring and Alerts

### Key Metrics to Monitor
- Total instrumentation data volume per hour
- Number of users with high sampling rates
- Cache hit rates and performance
- Error rates in span processing

### Recommended Alerts
- Data volume >100MB/hour across all users
- >10 users with 100% sampling rate
- Span processor errors >1% of total spans

## Migration and Rollback

### Safe Deployment
1. Deploy code with feature flag disabled
2. Test admin tools on staging
3. Enable user-aware processing gradually
4. Monitor data volume and performance

### Rollback Procedure
1. Set `enableUserSampling: false` in instrumentation config
2. Restart application to use standard BatchSpanProcessor
3. Clear user configs if needed: `db.users.updateMany({}, {$unset: {instrumentationConfig: 1}})`

## Future Enhancements

- Machine learning-based adaptive sampling
- Real-time instrumentation toggling via WebSocket
- Cost-based optimization with budget tracking
- Integration with APM platforms for automatic tuning