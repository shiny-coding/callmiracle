# Architecture Overview

## System Architecture

CallMiracle is a **Next.js 14** full-stack application implementing real-time video calling with comprehensive observability. The architecture follows a modern web application pattern with server-side rendering, API routes, and real-time subscriptions.

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (Next.js)     │◄──►│   (MongoDB)     │
│   Port 3003     │    │   GraphQL API   │    │   Collections   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebRTC        │    │   Observability │    │   File Storage  │
│   (Video Calls) │    │   (Monitoring)  │    │   (Profiles)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Technology Stack

### Core Technologies
- **Frontend**: Next.js 14 App Router, React 19, TypeScript
- **Styling**: Tailwind CSS, Material-UI (MUI), Emotion
- **Backend**: Next.js API Routes, GraphQL Yoga
- **Database**: MongoDB with connection pooling
- **Authentication**: NextAuth.js with MongoDB adapter

### Real-Time Features
- **WebRTC**: Direct peer-to-peer video/audio calling
- **GraphQL Subscriptions**: Real-time data updates
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **State Management**: Zustand for client state

### Observability Stack
- **Tracing**: OpenTelemetry with Tempo
- **Logging**: Winston with Loki aggregation
- **Metrics**: OpenTelemetry metrics with OTLP export
- **Visualization**: Grafana dashboards
- **Collection**: OTEL Collector and Promtail

### Infrastructure
- **Development**: Local development on port 3003
- **Production**: Docker containers with Docker Compose
- **Scaling**: Load balancer with multiple app instances
- **CDN**: Static asset serving

## Application Structure

### Next.js App Router Structure
```
src/app/
├── [locale]/                 # Internationalized routes
│   ├── layout.tsx            # Locale-specific layout
│   ├── auth/                 # Authentication pages
│   ├── groups/               # Group management
│   ├── meeting/              # Video meeting interface
│   ├── profile/              # User profile management
│   └── ...
├── api/                      # API routes
│   ├── auth/                 # NextAuth endpoints
│   ├── graphql/              # GraphQL endpoint
│   └── ...
└── globals.scss              # Global styles
```

### Key Architectural Patterns

#### 1. **Layered Architecture**
- **Presentation Layer**: React components and pages
- **API Layer**: GraphQL resolvers and REST endpoints
- **Business Logic**: Service functions and utilities
- **Data Layer**: MongoDB operations and schemas

#### 2. **Real-Time Communication**
- **WebRTC**: Peer-to-peer video/audio streams
- **GraphQL Subscriptions**: Server-sent events for notifications
- **Push Notifications**: Browser and mobile notifications

#### 3. **State Management**
- **Server State**: GraphQL with Apollo Client
- **Client State**: Zustand stores for UI state
- **Authentication State**: NextAuth session management

## Core Features Implementation

### 1. Video Calling (WebRTC)
**Files**: `src/hooks/webrtc/`, `src/components/CallerDialog.tsx`, `src/components/CalleeDialog.tsx`

```typescript
// WebRTC flow
Caller → Send Offer → Callee
Callee → Send Answer → Caller
Both → Exchange ICE candidates → Connection established
```

Key components:
- **WebRTCProvider**: Context for WebRTC state
- **useWebRTCCaller**: Hook for initiating calls
- **useWebRTCCallee**: Hook for receiving calls
- **Audio/Video controls**: Device selection and quality settings

### 2. Group Management
**Files**: `src/components/GroupForm.tsx`, `src/resolvers/groupsQueries.ts`

Features:
- Create/update groups with interests and languages
- Join tokens for group access
- Admin management and permissions
- Meeting transparency settings

### 3. Meeting Scheduling
**Files**: `src/components/MeetingForm.tsx`, `src/resolvers/meetingsMutations.ts`

Features:
- Time slot selection with timezone handling
- Interest-based matching
- Language preferences
- Age and gender filters

### 4. Real-Time Messaging
**Files**: `src/components/MessagesList.tsx`, `src/resolvers/conversationsMutations.ts`

Features:
- One-on-one conversations
- Message editing and deletion
- Read status tracking
- Real-time message delivery

### 5. Authentication & Authorization
**Files**: `src/app/api/auth/[...nextauth]/options.ts`, `src/lib/auth.ts`

Features:
- Email/password authentication
- OAuth providers support
- Session management
- User registration with profile setup

## Data Flow

### 1. **Request Flow**
```
Client Request → Next.js Middleware → API Route → GraphQL Resolver → MongoDB → Response
```

### 2. **Real-Time Flow**
```
Action → GraphQL Mutation → Database Update → Subscription Trigger → Client Update
```

### 3. **WebRTC Flow**
```
Caller → GraphQL signaling → Callee → Direct P2P connection
```

## Key Configuration Files

### Application Configuration
- **`src/config.ts`**: Locale configuration
- **`next.config.mjs`**: Next.js configuration with experimental features
- **`src/middleware.ts`**: Request middleware and internationalization

### Observability Configuration
- **`src/instrumentation.ts`**: OpenTelemetry setup
- **`observability/`**: Monitoring stack configuration
- **Docker Compose files**: Various deployment configurations

### Database Configuration
- **`src/lib/mongodb.ts`**: MongoDB connection setup
- **`src/schema/schema.graphql`**: GraphQL schema definition

## Development vs Production

### Development (Port 3003)
- Local MongoDB connection
- Hot reload with Turbopack
- Direct file serving
- Development observability stack

### Production (Docker)
- Containerized application
- Load balancing with nginx
- Production MongoDB
- Full observability stack with metrics collection

## Security Considerations

### Authentication
- Secure session management with NextAuth
- CSRF protection
- Secure cookie settings

### API Security
- GraphQL query validation
- Rate limiting middleware
- Input sanitization

### WebRTC Security
- STUN/TURN server configuration
- Secure signaling over HTTPS
- Media stream permissions

### Observability Privacy
- User data sampling controls
- Configurable logging levels
- Sensitive data filtering

## Performance Optimizations

### Frontend
- Next.js App Router with streaming
- Component lazy loading
- Image optimization with Sharp
- Tailwind CSS purging

### Backend
- MongoDB connection pooling
- GraphQL query optimization
- Caching strategies
- Background job processing

### Real-Time
- WebRTC direct connections (bypasses server)
- Efficient GraphQL subscriptions
- Optimized push notification delivery

## Scaling Strategy

The application supports horizontal scaling through:
- Multiple app instances behind load balancer
- Shared Redis for session storage
- MongoDB replica sets
- CDN for static assets

**Scaling Configuration**: `docker-compose.scale.yml` with nginx load balancer and multiple app instances.