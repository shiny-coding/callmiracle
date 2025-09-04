# CallMiracle Code Style and Conventions

## TypeScript Configuration
- Target: ES2017
- Strict mode enabled
- Module resolution: bundler
- Path aliases: `@/*` maps to `./src/*`
- JSX: preserve (handled by Next.js)

## File Organization & Structure
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components (PascalCase naming)
- `src/hooks/` - Custom React hooks (camelCase, prefixed with `use`)
- `src/resolvers/` - GraphQL resolvers
- `src/schema/` - GraphQL schema definitions
- `src/utils/` - Utility functions
- `src/contexts/` - React contexts
- `src/store/` - Zustand state management
- `src/config/` - Configuration files

## Naming Conventions
- **Components**: PascalCase (e.g., `UserCard.tsx`, `CalleeDialog.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`, `useWebRTCCaller.ts`)
- **Utilities**: camelCase (e.g., `formatDuration.ts`, `userUtils.ts`)
- **Constants**: UPPER_SNAKE_CASE or camelCase for objects
- **Types/Interfaces**: PascalCase (e.g., `UserCardProps`)

## Code Style
- **Client Components**: Start with `'use client'` directive
- **Imports**: Organized with external libraries first, then internal imports
- **Path aliases**: Use `@/` prefix for internal imports
- **TypeScript**: Explicit typing preferred, `any` allowed (ESLint rule disabled)
- **Functions**: Arrow functions preferred for components and utilities

## React Patterns
- Functional components only
- Hooks for state management and side effects
- Props interfaces defined above components
- Default parameters in destructuring
- Context providers for shared state
- Material-UI for UI components

## GraphQL Patterns
- Resolvers organized by domain (users, groups, meetings, etc.)
- Context object contains `{ db, session, logger }`
- Comprehensive logging in resolvers
- Error handling with custom error classes
- Authentication checks at resolver level

## Error Handling
- Custom error classes: `AuthenticationError`, `NotFoundError`
- Database errors wrapped with `handleDatabaseError`
- Comprehensive logging for all operations
- Client-side error boundaries where needed

## Logging Conventions
- Structured logging with context
- Log levels: info, warn, error, debug
- Include relevant metadata (userId, operation details)
- Distributed tracing integration with OpenTelemetry

## Internationalization
- `useTranslations()` hook for text
- Message keys in English
- Support for 'en' and 'ru' locales
- Localized routing with `[locale]` dynamic segments

## State Management
- Zustand for global state
- React Context for component tree state
- Local state with `useState` for component-specific data
- Custom hooks for reusable stateful logic