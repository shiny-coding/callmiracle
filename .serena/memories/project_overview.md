# CallMiracle Project Overview

## Purpose
CallMiracle is a Next.js application focused on real-time communication capabilities. It's a comprehensive video calling platform that supports:
- Video calling with WebRTC
- Group management and meetings
- Real-time messaging and notifications
- User profiles and authentication
- Call history and conversations
- Push notifications (FCM)
- Internationalization (i18n support for English and Russian)
- Comprehensive observability and monitoring

## Tech Stack
- **Framework**: Next.js 15.1.4 (App Router)
- **Language**: TypeScript (strict mode enabled)
- **Frontend**: React 19, Material-UI v6, Tailwind CSS
- **Backend**: GraphQL (GraphQL Yoga), MongoDB
- **Real-time**: WebRTC, GraphQL subscriptions, Redis (for pub/sub)
- **Authentication**: NextAuth.js with MongoDB adapter
- **State Management**: Zustand
- **Observability**: OpenTelemetry, Winston logging, Loki, Grafana, Tempo
- **Deployment**: Docker, Docker Compose
- **Internationalization**: next-intl

## Key Features
- WebRTC-based video calling (caller/callee scenarios)
- User and group management
- Real-time messaging system
- Call history tracking
- Firebase Cloud Messaging for push notifications
- Comprehensive logging and distributed tracing
- Multi-language support (English/Russian)
- Profile management with photo uploads
- Meeting scheduling and calendar integration

## Development Environment
- Runs on port 3003 in development
- Uses Turbopack for fast development builds
- Node.js debugging enabled on port 9229
- MongoDB for data persistence
- Redis for real-time subscriptions and caching