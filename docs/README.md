# CallMiracle Documentation

This directory contains comprehensive documentation for the CallMiracle project, designed to help both developers and LLMs understand the codebase structure, patterns, and implementation details.

## Documentation Structure

### Architecture & Design
- **[Architecture Overview](./architecture.md)** - System architecture, design patterns, and tech stack
- **[API Documentation](./api.md)** - GraphQL schema, resolvers, and API endpoints
- **[Database Schema](./database.md)** - MongoDB collections and data models

### Components & Implementation
- **[Component Guide](./components.md)** - React component structure and patterns
- **[WebRTC Implementation](./webrtc.md)** - Video calling and real-time communication
- **[State Management](./state-management.md)** - Store patterns and data flow

### Operations & Monitoring
- **[Observability](./observability.md)** - Monitoring, logging, and tracing setup
- **[Authentication](./authentication.md)** - NextAuth.js configuration and user management
- **[Internationalization](./i18n.md)** - Multi-language support and localization

### Development
- **[Development Guide](./development.md)** - Setup, patterns, and best practices
- **[File Structure](./file-structure.md)** - Project organization and naming conventions

## Quick Reference

### Key Technologies
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: GraphQL, MongoDB, Next.js API routes
- **Real-time**: WebRTC, GraphQL subscriptions
- **Authentication**: NextAuth.js
- **Observability**: OpenTelemetry, Loki, Grafana, Tempo

### Important Commands
```bash
yarn dev          # Development server (port 3003)
yarn build        # Production build
yarn typecheck    # TypeScript validation
yarn lint         # ESLint checks
```

### Development Port
The application runs on **port 3003** in development mode (not containerized).

## For LLMs: Understanding This Codebase

This documentation is specifically structured to help Large Language Models understand:

1. **Architecture Patterns** - How components interact and data flows
2. **File Organization** - Where to find specific functionality
3. **Implementation Patterns** - Common patterns used throughout the codebase
4. **Configuration** - How different systems are configured and connected
5. **Data Models** - Structure of data and relationships
6. **API Contracts** - GraphQL schema and expected interactions

Each documentation file includes:
- **Overview** - High-level understanding
- **Key Files** - Important files to examine
- **Patterns** - Common implementation patterns
- **Examples** - Code examples and usage patterns
- **Relationships** - How components/systems connect

Start with `architecture.md` for a system overview, then explore specific areas based on your needs.