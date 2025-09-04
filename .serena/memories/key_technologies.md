# CallMiracle Key Technologies and Implementation Details

## Frontend Technologies

### Next.js 15.1.4 (App Router)
- Uses App Router (not Pages Router)
- Server-side rendering and client-side components
- API routes in `/api` directory
- Internationalized routing with `[locale]` segments
- Turbopack for fast development builds

### React 19
- Functional components only
- Hooks-based state management
- Client components marked with `'use client'`
- Context providers for cross-component state

### Material-UI v6
- `@mui/material` for UI components
- `@mui/icons-material` for icons
- Theme provider integration
- Responsive design patterns

### WebRTC Implementation
- Custom hooks: `useWebRTCCaller`, `useWebRTCCallee`, `useWebRTCCommon`
- WebRTC context provider for global state
- Support for audio/video device selection
- Screen sharing capabilities

## Backend Technologies

### GraphQL with GraphQL Yoga
- Single endpoint at `/api/graphql`
- Subscription support for real-time features
- Custom resolvers organized by domain
- Type-safe with generated TypeScript types

### MongoDB
- Native MongoDB driver (not Mongoose)
- Collections: users, groups, meetings, calls, conversations
- ObjectId handling for relationships
- Connection management in `src/lib/mongodb.ts`

### NextAuth.js
- MongoDB adapter for session storage
- Custom user registration flow
- JWT token handling
- Session context throughout application

### Redis & Subscriptions
- Redis for GraphQL subscription pub/sub
- `graphql-redis-subscriptions` package
- Real-time notifications and messaging
- Caching layer for performance

## Real-time Communication

### WebRTC Stack
- Peer-to-peer video calling
- Audio/video device management
- Call state management (caller/callee scenarios)
- Network quality handling

### GraphQL Subscriptions
- Real-time notifications
- Live message updates
- Call status changes
- Group membership changes

## Observability Stack

### OpenTelemetry
- Distributed tracing
- Custom instrumentation for user actions
- Integration with Tempo for trace storage
- Automatic HTTP and GraphQL instrumentation

### Logging (Winston + Loki)
- Structured JSON logging
- Multiple log levels (debug, info, warn, error)
- Loki for log aggregation
- Daily log rotation
- Request correlation IDs

### Monitoring
- Grafana dashboards
- Custom metrics for user activity
- Performance monitoring
- Error tracking and alerting

## Deployment & Infrastructure

### Docker Configuration
- Multi-stage Docker builds
- Development and production configurations
- Observability stack as separate compose file
- Scaling configuration with load balancer

### Production Optimizations
- Standalone Next.js output
- Image optimization disabled for Docker
- Source maps for production debugging
- Webpack bundle optimization

## State Management

### Zustand
- Global application state
- Reactive state updates
- TypeScript-first design
- Lightweight alternative to Redux

### React Context
- Domain-specific contexts (Notifications, Meetings, etc.)
- Server context for environment switching
- Subscription context for GraphQL real-time

## Internationalization

### next-intl
- Translation management
- Locale-based routing
- Message files in JSON format
- Server and client-side translation support
- Currently supports English (`en`) and Russian (`ru`)

## Security Considerations
- Authentication checks in GraphQL resolvers
- Input validation and sanitization
- CORS configuration
- Secure session management
- Error handling without information leakage