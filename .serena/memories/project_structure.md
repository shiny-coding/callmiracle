# CallMiracle Project Structure

## Root Directory
```
callmiracle/
├── src/                    # Source code
├── public/                 # Static assets and user profiles
├── observability/          # Monitoring configuration
├── scripts/                # Development utilities
├── docs/                   # Documentation
├── messages/               # i18n message files
├── .github/                # GitHub Actions workflows
└── docker-compose*.yml     # Docker configurations
```

## Source Code Structure (`src/`)

### Application Routes (`src/app/`)
- **App Router structure** with nested routes
- `api/` - API routes and GraphQL endpoint
- `[locale]/` - Internationalized pages
- Route handlers in `route.ts` files
- Page components in `page.tsx` files

### Components (`src/components/`)
- **UI Components**: UserCard, GroupCard, MeetingCard, etc.
- **Dialog Components**: CalleeDialog, CallerDialog, LoadingDialog
- **Form Components**: ProfileForm, GroupForm, MeetingForm
- **Provider Components**: SessionProvider, ThemeProvider
- **Utility Components**: UserAvatar, NotificationBadge

### Hooks (`src/hooks/`)
- **WebRTC Hooks**: useWebRTCCaller, useWebRTCCallee, useWebRTCCommon
- **API Hooks**: useUpdateUser, useDeleteMeeting, useRemoveUserFromGroup
- **Utility Hooks**: useAuth, useFetch, usePlaySound

### Backend (`src/resolvers/`, `src/schema/`)
- **GraphQL Resolvers**: Organized by domain (users, groups, meetings, calls)
- **Schema Definitions**: GraphQL schema in `schema.graphql`
- **Types**: TypeScript types for resolvers

### State Management (`src/store/`)
- **Zustand Store**: Global state management
- **Context Providers**: React Context for specific domains
- **Store Providers**: UsersProvider, GroupsProvider, ConversationsProvider

### Utilities (`src/utils/`)
- **Logging**: Winston-based logging with Loki integration
- **Observability**: OpenTelemetry instrumentation
- **Error Handling**: Custom error classes and handling
- **Formatting**: Date, time, and text formatting utilities

### Configuration (`src/config/`)
- **App Configuration**: Main config file
- **Language Configuration**: Supported languages and locales
- **Video Configuration**: WebRTC and video calling settings

### Types (`src/types/`)
- **Type Definitions**: Custom TypeScript types
- **NextAuth Types**: Authentication type extensions
- **GraphQL Generated Types**: Auto-generated from schema

## Key Configuration Files
- `next.config.mjs` - Next.js configuration with webpack customizations
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - ESLint configuration  
- `tailwind.config.ts` - Tailwind CSS configuration
- `codegen.ts` - GraphQL code generation configuration
- `docker-compose.yml` - Main Docker setup
- `docker-compose.observability.yml` - Monitoring stack

## Development Scripts (`scripts/`)
- `dev-utils.js` - Port management utilities
- `kill-port.js` - Kill processes on specific ports
- `shutdown-dev.js` - Graceful shutdown handling
- `setup-db.mjs` - Database initialization
- `generate-ssl.mjs` - SSL certificate generation

## Public Assets (`public/`)
- `profiles/` - User profile images
- Static assets (favicons, etc.)

## Observability (`observability/`)
- Grafana dashboards
- Loki configuration
- Tempo tracing configuration
- Docker compose for monitoring stack