# CallMiracle Project Documentation

## Project Overview
CallMiracle is a Next.js application with real-time communication capabilities, built with TypeScript, GraphQL, and MongoDB. It features video calling, group management, messaging, and comprehensive observability.

## Tech Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: GraphQL, MongoDB, Next.js API routes
- **Real-time**: WebRTC, GraphQL subscriptions
- **Authentication**: NextAuth.js
- **Observability**: OpenTelemetry, Loki, Grafana, Tempo
- **Deployment**: Docker, Docker Compose

## Key Features
- Video calling with WebRTC
- Group management and meetings
- Real-time messaging and notifications
- User profiles and authentication
- Call history and conversations
- Push notifications (FCM)
- Internationalization (i18n)
- Comprehensive logging and monitoring

## Important Scripts
- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
- `yarn typecheck` - Run TypeScript checks

## Project Structure
- `src/app/` - Next.js app router pages and API routes
- `src/components/` - React components
- `src/hooks/` - Custom React hooks
- `src/resolvers/` - GraphQL resolvers
- `src/schema/` - GraphQL schema definitions
- `src/utils/` - Utility functions and logging
- `src/contexts/` - React contexts
- `src/store/` - State management
- `observability/` - Monitoring and logging configuration
- `public/` - Static assets

## Key Files
- `src/config.ts` - Main configuration
- `src/middleware.ts` - Request middleware
- `src/instrumentation.ts` - OpenTelemetry setup
- `docker-compose.yml` - Main Docker setup
- `docker-compose.observability.yml` - Observability stack

## Database
- MongoDB connection configured in `src/lib/mongodb.ts`
- User profiles stored in `/public/profiles/`

## Authentication
- NextAuth.js configuration in `src/app/api/auth/[...nextauth]/options.ts`
- Session management and user registration

## WebRTC Implementation
- WebRTC hooks in `src/hooks/webrtc/`
- Video calling components for caller/callee scenarios

## Observability
- OpenTelemetry instrumentation
- Loki for log aggregation
- Grafana dashboards
- Tempo for tracing
- Custom logging utilities in `src/utils/`

##
- While developing I'm running the app in dev-mode on port 3003, not in a container

## Recent Changes
Based on commit history:
- Enhanced observability setup and logging features
- Refactored observability configuration
- Enhanced request context handling and logging
- Improved middleware for better request tracking