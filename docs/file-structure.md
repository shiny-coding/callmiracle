# File Structure Guide

## Overview

CallMiracle follows Next.js 14 App Router conventions with clear separation of concerns and logical organization for maintainability and scalability.

## Root Directory Structure

```
callmiracle/
├── src/                      # Source code
├── public/                   # Static assets
├── docs/                     # Documentation
├── observability/            # Monitoring configuration
├── scripts/                  # Build and utility scripts
├── logs/                     # Application logs
├── messages/                 # i18n messages (deprecated - moved to src/)
├── certs/                    # SSL certificates
├── keys/                     # Authentication keys
├── notes/                    # Development notes
├── package.json              # Dependencies and scripts
├── next.config.mjs           # Next.js configuration
├── docker-compose*.yml       # Docker configurations
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
├── eslint.config.mjs         # ESLint configuration
└── CLAUDE.md                 # Project documentation
```

## Source Code Structure (`src/`)

### Application Layer (`src/app/`)
Next.js 14 App Router structure with internationalization support.

```
src/app/
├── [locale]/                 # Internationalized routes
│   ├── layout.tsx           # Locale-specific layout wrapper
│   ├── ClientLayout.tsx     # Client-side layout component
│   ├── auth/                # Authentication pages
│   │   ├── layout.tsx       # Auth layout
│   │   ├── signin/page.tsx  # Sign-in page
│   │   └── signout/page.tsx # Sign-out page
│   ├── groups/              # Group management
│   │   ├── page.tsx         # Groups list
│   │   ├── create/page.tsx  # Create group
│   │   └── [id]/page.tsx    # Group details
│   ├── meeting/             # Video meeting interface
│   │   ├── page.tsx         # Meeting lobby
│   │   └── [id]/page.tsx    # Active meeting room
│   ├── profile/page.tsx     # User profile management
│   ├── users/page.tsx       # User directory
│   ├── conversations/page.tsx # Messaging interface
│   ├── call-history/page.tsx # Call history
│   ├── calendar/page.tsx    # Meeting calendar
│   ├── list/page.tsx        # Meeting list
│   └── first-time/page.tsx  # Onboarding
├── api/                     # API routes
│   ├── auth/                # Authentication endpoints
│   │   ├── [...nextauth]/   # NextAuth.js handlers
│   │   ├── register/        # User registration
│   │   ├── reset/           # Password reset
│   │   └── send-reset-code/ # Password reset email
│   ├── graphql/route.ts     # GraphQL endpoint
│   ├── upload-photo/        # Profile photo upload
│   ├── delete-photo/        # Profile photo deletion
│   ├── profiles/[id]/       # Profile image serving
│   ├── join-group/          # Group joining via token
│   ├── save-fcm-token/      # Push notification tokens
│   ├── update-locale/       # User locale preference
│   ├── select-server/       # Load balancer server selection
│   ├── log/                 # Client-side logging
│   └── admin/               # Administrative endpoints
│       └── instrumentation/ # Observability configuration
├── layout.tsx               # Root layout
├── globals.scss             # Global styles
└── favicon.ico              # Favicon
```

### Component Layer (`src/components/`)
Reusable React components organized by functionality.

```
src/components/
├── AppContent.tsx           # Main app wrapper with providers
├── ClientWrapper.tsx        # Client-side wrapper component
├── ThemeProvider.tsx        # MUI theme provider
├── ThemeRegistry.tsx        # Theme registration
├── LoadingDialog.tsx        # Loading state dialog
├── ConfirmDialog.tsx        # Confirmation dialogs
├── ConfirmationDialog.tsx   # Alternative confirmation dialog
├── RequestIdInjector.tsx    # Request correlation ID injection
├── ViewportHeightSetter.tsx # Mobile viewport height handler
├── InitialMessageHandler.tsx # Startup message handler

# User Management Components
├── UserCard.tsx             # User display card
├── UserList.tsx             # User directory listing
├── UserAvatar.tsx           # User profile avatar
├── UserDetailsPopup.tsx     # User information popup
├── UserImagePopup.tsx       # User image viewer
├── UsersFilters.tsx         # User filtering controls
├── ProfileForm.tsx          # User profile editing form
├── ProfileIncompleteDialog.tsx # Profile completion prompt

# Group Management Components
├── GroupCard.tsx            # Group display card
├── GroupList.tsx            # Groups listing
├── GroupForm.tsx            # Group creation/editing form
├── GroupSelector.tsx        # Group selection component
├── SingleGroupSelector.tsx  # Single group picker
├── GroupsFilters.tsx        # Group filtering controls

# Meeting Components
├── MeetingCard.tsx          # Meeting display card
├── MeetingsList.tsx         # Meetings listing
├── MeetingForm.tsx          # Meeting creation/editing form
├── MeetingCardUtils.tsx     # Meeting card utilities
├── MeetingFormUtils.ts      # Meeting form utilities
├── MeetingsCalendar.tsx     # Calendar view of meetings
├── MeetingsCalendarRow.tsx  # Calendar row component
├── MeetingsCalendarUtils.ts # Calendar utilities
├── MeetingsFilters.tsx      # Meeting filtering controls
├── TimeSlotsGrid.tsx        # Time slot selection grid

# Video Calling Components
├── CallerDialog.tsx         # Outgoing call interface
├── CalleeDialog.tsx         # Incoming call interface
├── LocalVideo.tsx           # Local camera feed
├── RemoteVideo.tsx          # Remote user video feed
├── VideoDeviceSelector.tsx  # Camera selection
├── AudioDeviceSelector.tsx  # Microphone selection
├── DeviceSelector.tsx       # Generic device selector
├── VideoQualitySelector.tsx # Video quality controls

# Call History Components
├── CallHistory.tsx          # Call history summary
├── CallHistoryPopup.tsx     # Call history popup
├── DetailedCallHistory.tsx  # Detailed call records
├── DetailedCallHistoryDialog.tsx # Call history dialog

# Messaging Components
├── MessagesList.tsx         # Chat message display
├── ConversationsList.tsx    # Conversation list

# Navigation & Controls
├── PageHeader.tsx           # Page header component
├── TopControlsBar.tsx       # Top action bar
├── BottomControlsBar.tsx    # Bottom action bar

# Notification Components
├── NotificationBadge.tsx    # Notification count badge
├── NotificationsList.tsx    # Notifications listing
├── NotificationsPopup.tsx   # Notifications popup

# Form Components
├── InterestSelector.tsx     # Interest selection component
├── InterestsDescriptionsEditor.tsx # Interest descriptions editor
├── InterestsPairsEditor.tsx # Interest pairs editor
├── LanguageSelector.tsx     # Language selection
├── LocaleSelector.tsx       # Locale/region selection
├── PasswordResetTab.tsx     # Password reset form

# Configuration Components
├── ClientLoggerConfig.tsx   # Client-side logging configuration

# Provider Components
└── providers/
    └── SessionProvider.tsx  # NextAuth session provider
```

### Hooks Layer (`src/hooks/`)
Custom React hooks for business logic and state management.

```
src/hooks/
├── useAuth.ts               # Authentication state and actions
├── useInitUser.ts           # User initialization on app start
├── useUpdateUser.ts         # User profile updates
├── useDeleteMeeting.ts      # Meeting deletion operations
├── useUpdateMeeting.ts      # Meeting updates
├── useUpdateGroup.ts        # Group updates
├── useRemoveUserFromGroup.ts # Group membership management
├── useRegenerateJoinToken.ts # Group join token regeneration
├── useCheckImage.ts         # Image validation
├── useClientPushNotifications.ts # Push notification handling
├── useFetch.ts              # Generic data fetching
├── usePlaySound.ts          # Sound effects playback

# WebRTC Hooks
└── webrtc/
    ├── WebRTCProvider.tsx   # WebRTC context provider
    ├── useWebRTCCommon.ts   # Shared WebRTC functionality
    ├── useWebRTCCaller.ts   # Outgoing call management
    └── useWebRTCCallee.ts   # Incoming call management
```

### GraphQL Layer (`src/schema/` & `src/resolvers/`)

```
src/schema/
├── schema.graphql           # GraphQL schema definition
└── schema.ts                # Schema compilation

src/resolvers/
├── index.ts                 # Resolver composition
├── types.ts                 # TypeScript types for resolvers
├── scalarResolvers.ts       # Custom scalar resolvers (Date)

# Query Resolvers
├── usersQueries.ts          # User data queries
├── groupsQueries.ts         # Group data queries
├── meetingsQueries.ts       # Meeting data queries
├── callsQueries.ts          # Call history queries
├── notificationsQueries.ts  # Notification queries
├── conversationsQueries.ts  # Messaging queries

# Mutation Resolvers
├── updateUserMutation.ts    # User updates
├── deleteUserMutation.ts    # User deletion
├── callUserMutation.ts      # WebRTC signaling
├── meetingsMutations.ts     # Meeting operations
├── groupsMutations.ts       # Group operations
├── notificationsMutations.ts # Notification operations
├── conversationsMutations.ts # Messaging operations
├── createOrUpdateMeeting.ts # Meeting creation/updates
├── connectMeetings.ts       # Meeting connection logic
├── publishNotifications.ts  # Notification publishing
└── pushNotifications.ts     # Push notification sending

# Subscription Resolvers
└── subscriptions.ts         # Real-time subscriptions
```

### State Management (`src/store/` & `src/contexts/`)

```
src/store/
├── useStore.ts              # Main Zustand store
├── UsersProvider.tsx        # Users data provider
├── GroupsProvider.tsx       # Groups data provider
├── ConversationsProvider.tsx # Conversations provider
└── DetailedCallHistoryProvider.tsx # Call history provider

src/contexts/
├── SubscriptionsContext.tsx # GraphQL subscriptions
├── NotificationsContext.tsx # Notification management
├── MeetingsContext.tsx      # Meeting state management
├── ServerContext.tsx        # Server selection context
└── SnackContext.tsx         # Snackbar notifications
```

### Library Layer (`src/lib/`)
Core library integrations and configurations.

```
src/lib/
├── apollo.ts                # Apollo Client configuration
├── apollo-provider.tsx      # Apollo Provider wrapper
├── auth.ts                  # NextAuth configuration
├── mongodb.ts               # MongoDB connection
└── pubsub.ts                # GraphQL subscription PubSub
```

### Utilities (`src/utils/`)
Utility functions and helpers.

```
src/utils/
├── utils.ts                 # Generic utilities (moved to utils.ts in root)
├── commonUtils.ts           # Common utility functions
├── formatDuration.ts        # Time duration formatting
├── formatRelativeTime.ts    # Relative time formatting
├── formatTextWithLinks.tsx  # Text formatting with links
├── textNormalization.ts     # Text normalization utilities
├── meetingUtils.ts          # Meeting-specific utilities
├── userUtils.ts             # User-specific utilities
├── notificationUtils.ts     # Notification utilities
├── language.ts              # Language utilities
├── jwt.ts                   # JWT token utilities

# Logging & Observability
├── logger.ts                # Server-side Winston logger
├── logger-loki.ts           # Loki logging transport
├── clientLogger.ts          # Client-side logging
├── logUtils.ts              # Logging utilities
├── requestContext.ts        # Request correlation context
├── tracing.ts               # OpenTelemetry tracing utilities
├── middleware-tracing.ts    # Middleware tracing helpers
├── user-instrumentation.ts # User-specific instrumentation
├── admin-instrumentation.ts # Admin instrumentation controls
├── observabilityTest.ts     # Observability testing utilities

# Error Handling
└── error.ts                 # Error handling utilities
```

### Instrumentation (`src/instrumentation/`)
OpenTelemetry instrumentation components.

```
src/instrumentation/
├── context-keys.ts          # OpenTelemetry context keys
├── user-cache.ts            # User data caching for tracing
└── user-sampler.ts          # User-aware trace sampling
```

### Middleware (`src/middleware/`)
Request processing middleware.

```
src/middleware/
└── requestLogger.ts         # Request logging middleware
```

### Configuration (`src/config/`)
Application configuration modules.

```
src/config/
├── constants.ts             # Application constants
├── languages.ts             # Supported languages
└── video.ts                 # Video quality configurations
```

### Internationalization (`src/i18n/` & `src/messages/`)

```
src/i18n/
├── request.ts               # Server-side i18n
└── routing.ts               # i18n routing configuration

src/messages/
├── en.json                  # English translations
└── ru.json                  # Russian translations
```

### Generated Code (`src/generated/`)
Auto-generated TypeScript types from GraphQL schema.

```
src/generated/
└── graphql.tsx              # Generated GraphQL types and hooks
```

### Type Definitions (`src/types/`)
Custom TypeScript type definitions.

```
src/types/
└── next-auth.d.ts           # NextAuth type extensions
```

## Static Assets (`public/`)

```
public/
├── design/                  # Design assets and mockups
├── profiles/                # User profile images (uploaded)
├── sounds/                  # Audio files for notifications
├── logo-*.png               # Application logos
├── manifest.json            # PWA manifest
├── sw.js                    # Service worker
├── space*.jpg               # Background images
└── *.svg                    # Icon assets
```

## Observability Configuration (`observability/`)

```
observability/
├── grafana/                 # Grafana configuration
│   ├── dashboards/          # Dashboard definitions
│   └── provisioning/        # Grafana provisioning config
├── loki/
│   └── loki.yaml            # Loki configuration
├── otel-collector/
│   └── config.yaml          # OpenTelemetry Collector config
├── promtail/
│   └── promtail.yaml        # Promtail log shipping config
└── tempo/
    └── tempo.yaml           # Tempo tracing backend config
```

## Scripts (`scripts/`)

```
scripts/
├── generate-ssl.mjs         # SSL certificate generation
├── kill-port.js             # Port cleanup utility
├── manage-instrumentation.js # Observability management
├── setup-db.mjs             # Database initialization
└── start-observability.sh   # Observability stack startup
```

## File Naming Conventions

### Component Files
- **React Components**: PascalCase with `.tsx` extension
  - `UserCard.tsx`, `MeetingForm.tsx`, `VideoQualitySelector.tsx`
- **Component Utilities**: PascalCase with descriptive suffix
  - `MeetingCardUtils.tsx`, `MeetingFormUtils.ts`

### Hook Files
- **Custom Hooks**: camelCase starting with `use`
  - `useAuth.ts`, `useWebRTCCaller.ts`, `useUpdateUser.ts`

### Utility Files
- **Utilities**: camelCase descriptive names
  - `formatDuration.ts`, `commonUtils.ts`, `textNormalization.ts`

### Configuration Files
- **Config Files**: camelCase or descriptive names
  - `next.config.mjs`, `tailwind.config.ts`, `constants.ts`

### GraphQL Files
- **Schema**: `schema.graphql`
- **Resolvers**: descriptive names with type suffix
  - `usersQueries.ts`, `meetingsMutations.ts`, `subscriptions.ts`

## Import Path Conventions

### Absolute Imports
Use `@/` prefix for absolute imports from `src/` directory:

```typescript
// ✅ Preferred
import { useStore } from '@/store/useStore'
import { formatDuration } from '@/utils/formatDuration'
import type { User } from '@/generated/graphql'

// ❌ Avoid relative imports for src/ files
import { useStore } from '../../../store/useStore'
```

### Import Order
1. External libraries
2. Internal modules (using `@/`)
3. Types and interfaces
4. Local files (relative imports)

```typescript
// 1. External libraries
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@mui/material'

// 2. Internal modules
import { useStore } from '@/store/useStore'
import { formatDate } from '@/utils/commonUtils'

// 3. Types
import type { User } from '@/generated/graphql'
import type { ComponentProps } from './types'

// 4. Local files
import './Component.styles.css'
```

## Directory Organization Principles

1. **Feature-Based Grouping**: Related functionality grouped together
2. **Layer Separation**: Clear separation between UI, business logic, and data layers
3. **Scalability**: Structure supports growing codebase
4. **Convention Over Configuration**: Consistent naming and organization
5. **Discoverability**: Logical placement makes files easy to find

This file structure provides a clear, scalable foundation for the CallMiracle application with logical organization and consistent conventions.