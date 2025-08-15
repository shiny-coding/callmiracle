# Component Structure and Patterns

## Overview

CallMiracle follows a component-based architecture using React 19 with Next.js 14 App Router. The component structure emphasizes reusability, type safety, and clear separation of concerns.

## Component Architecture

### Layer Structure
```
┌─────────────────────────────────────────────────────────────┐
│                    Page Components                          │
│                (src/app/[locale]/)                         │
├─────────────────────────────────────────────────────────────┤
│                 Layout Components                          │
│            (Providers, Context Wrappers)                   │
├─────────────────────────────────────────────────────────────┤
│                Feature Components                          │
│        (VideoCall, Groups, Meetings, Messages)             │
├─────────────────────────────────────────────────────────────┤
│                  UI Components                             │
│           (Forms, Cards, Dialogs, Controls)                │
├─────────────────────────────────────────────────────────────┤
│                 Base Components                            │
│         (Buttons, Inputs, Typography, Icons)               │
└─────────────────────────────────────────────────────────────┘
```

## Core Component Patterns

### 1. Provider Pattern
**Purpose**: Centralized state management and context provision

**Example**: `AppContent.tsx`
```typescript
export function AppContent({ children }: AppContentProps) {
  const { loading, error } = useInitUser()
  if (loading || error) return <LoadingDialog loading={loading} error={error} />

  return (
    <SubscriptionsProvider>      // GraphQL subscriptions
      <MeetingsProvider>         // Meeting state
        <UsersProvider>          // User data
          <GroupsProvider>       // Group data
            <SnackbarProvider>   // Notifications
              <NotificationsProvider>
                {children}
              </NotificationsProvider>
            </SnackbarProvider>
          </GroupsProvider>
        </UsersProvider>
      </MeetingsProvider>
    </SubscriptionsProvider>
  )
}
```

**Key Providers**:
- **`SubscriptionsProvider`**: Real-time GraphQL subscriptions
- **`WebRTCProvider`**: Video call state and operations
- **`UsersProvider`**: User data and filtering
- **`GroupsProvider`**: Group management
- **`NotificationsProvider`**: Notification system

### 2. Hook-Based Logic Pattern
**Purpose**: Separate business logic from UI components

**Examples**:
```typescript
// Custom hooks for specific functionality
useWebRTCCaller()     // WebRTC caller logic
useWebRTCCallee()     // WebRTC callee logic  
useInitUser()         // User initialization
useUpdateUser()       // User updates
useDeleteMeeting()    // Meeting operations
```

### 3. Dialog/Modal Pattern
**Purpose**: Consistent modal interfaces for complex interactions

**Key Dialog Components**:
- **`CallerDialog`**: Video call initiation interface
- **`CalleeDialog`**: Incoming call interface
- **`LoadingDialog`**: Loading states with error handling
- **`ConfirmDialog`**: User confirmations
- **`UserDetailsPopup`**: User profile viewing
- **`CallHistoryPopup`**: Call history details

**Pattern**:
```typescript
interface DialogProps {
  open: boolean
  onClose: () => void
  // Specific props for dialog content
}

export function MyDialog({ open, onClose, ...props }: DialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Title</DialogTitle>
      <DialogContent>
        {/* Content */}
      </DialogContent>
      <DialogActions>
        {/* Actions */}
      </DialogActions>
    </Dialog>
  )
}
```

### 4. Form Component Pattern
**Purpose**: Consistent form handling with validation

**Key Form Components**:
- **`ProfileForm`**: User profile editing
- **`GroupForm`**: Group creation/editing
- **`MeetingForm`**: Meeting scheduling
- **`PasswordResetTab`**: Authentication forms

**Pattern**:
```typescript
interface FormProps {
  initialData?: DataType
  onSubmit: (data: DataType) => Promise<void>
  onCancel?: () => void
}

export function MyForm({ initialData, onSubmit, onCancel }: FormProps) {
  const [formData, setFormData] = useState(initialData || defaultData)
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

### 5. List/Grid Pattern
**Purpose**: Consistent data display with filtering and actions

**Key List Components**:
- **`UserList`**: User directory with filtering
- **`GroupList`**: Group management interface
- **`MeetingsList`**: Meeting scheduling interface
- **`MessagesList`**: Chat message display
- **`ConversationsList`**: Conversation overview

**Pattern**:
```typescript
interface ListProps {
  items: ItemType[]
  filters?: FilterType
  onItemClick?: (item: ItemType) => void
  onItemAction?: (action: string, item: ItemType) => void
}

export function MyList({ items, filters, onItemClick, onItemAction }: ListProps) {
  const filteredItems = useMemo(() => 
    applyFilters(items, filters), [items, filters]
  )
  
  return (
    <div className="space-y-2">
      {filteredItems.map(item => (
        <ItemCard 
          key={item.id} 
          item={item}
          onClick={() => onItemClick?.(item)}
          onAction={(action) => onItemAction?.(action, item)}
        />
      ))}
    </div>
  )
}
```

## Feature Component Categories

### 1. Video Calling Components
**Files**: `CallerDialog.tsx`, `CalleeDialog.tsx`, `LocalVideo.tsx`, `RemoteVideo.tsx`

**Key Features**:
- WebRTC peer connection management
- Audio/video device selection
- Call quality controls
- Connection status indicators

**Architecture**:
```typescript
// WebRTC Context Provider
<WebRTCProvider>
  <CallerDialog />     // For initiating calls
  <CalleeDialog />     // For receiving calls
  <LocalVideo />       // Local camera feed
  <RemoteVideo />      // Remote user feed
</WebRTCProvider>
```

### 2. Group Management Components
**Files**: `GroupForm.tsx`, `GroupList.tsx`, `GroupCard.tsx`, `GroupSelector.tsx`

**Key Features**:
- Group creation and editing
- Member management
- Join token handling
- Interest and language configuration

### 3. Meeting Components
**Files**: `MeetingForm.tsx`, `MeetingsList.tsx`, `MeetingCard.tsx`, `MeetingsCalendar.tsx`

**Key Features**:
- Meeting scheduling with time slots
- Interest-based matching
- Meeting status management
- Calendar visualization

### 4. User Management Components
**Files**: `UserList.tsx`, `UserCard.tsx`, `ProfileForm.tsx`, `UserAvatar.tsx`

**Key Features**:
- User profile management
- User discovery and filtering
- Contact information display
- Avatar and photo handling

### 5. Messaging Components
**Files**: `MessagesList.tsx`, `ConversationsList.tsx`

**Key Features**:
- Real-time message display
- Conversation management
- Message editing and deletion
- Read status tracking

### 6. Navigation Components
**Files**: `PageHeader.tsx`, `BottomControlsBar.tsx`, `TopControlsBar.tsx`

**Key Features**:
- Consistent navigation patterns
- Action button placement
- Status indicators
- Responsive design

## Styling and Design System

### Material-UI Integration
- **Theme**: Custom MUI theme with dark/light mode support
- **Components**: Extensive use of MUI components
- **Customization**: Theme overrides for brand consistency

### Tailwind CSS
- **Utility Classes**: Rapid styling with utility classes
- **Responsive Design**: Mobile-first responsive patterns
- **Custom Classes**: Extended with custom utilities

### Component Styling Pattern
```typescript
// Combination of MUI components with Tailwind utilities
<Card className="w-full max-w-md mx-auto">
  <CardContent className="p-6">
    <Typography variant="h6" className="mb-4">
      Title
    </Typography>
    <TextField 
      className="w-full mb-4"
      variant="outlined"
      label="Input"
    />
  </CardContent>
</Card>
```

## State Management Patterns

### 1. Zustand Store Pattern
**File**: `src/store/useStore.ts`

```typescript
interface StoreState {
  user: User | null
  setUser: (user: User) => void
  groups: Group[]
  setGroups: (groups: Group[]) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      groups: [],
      setGroups: (groups) => set({ groups })
    }),
    { name: 'callmiracle-storage' }
  )
)
```

### 2. Apollo Client Integration
**Pattern**: GraphQL operations with automatic type generation

```typescript
// Generated hooks from GraphQL operations
const { data: users, loading, error } = useGetUsersQuery()
const [updateUser] = useUpdateUserMutation()

// Usage in components
const handleUpdateUser = async (userData: UserInput) => {
  try {
    await updateUser({ variables: { input: userData } })
  } catch (error) {
    // Error handling
  }
}
```

### 3. Context Pattern for Feature State
**Example**: Subscription management

```typescript
const SubscriptionsContext = createContext<SubscriptionsContextType | null>(null)

export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  const { data: subscriptionData } = useSubscription(ON_SUBSCRIPTION_EVENT)
  
  // Process subscription events
  useEffect(() => {
    if (subscriptionData?.onSubscriptionEvent) {
      handleSubscriptionEvent(subscriptionData.onSubscriptionEvent)
    }
  }, [subscriptionData])
  
  return (
    <SubscriptionsContext.Provider value={contextValue}>
      {children}
    </SubscriptionsContext.Provider>
  )
}
```

## Component Organization

### File Naming Conventions
- **PascalCase**: Component files (e.g., `UserCard.tsx`)
- **camelCase**: Hook files (e.g., `useUpdateUser.ts`)
- **SCREAMING_SNAKE_CASE**: Constants and enums

### Import Organization
```typescript
// External libraries
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@mui/material'

// Internal utilities
import { useStore } from '@/store/useStore'
import { formatDate } from '@/utils/commonUtils'

// Types
import type { User } from '@/generated/graphql'

// Components
import UserAvatar from './UserAvatar'
```

### Component Structure Template
```typescript
// Types and interfaces
interface ComponentProps {
  // Props definition
}

// Main component
export default function Component({ ...props }: ComponentProps) {
  // State
  const [state, setState] = useState()
  
  // Effects
  useEffect(() => {
    // Side effects
  }, [])
  
  // Event handlers
  const handleEvent = () => {
    // Handler logic
  }
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  )
}
```

## Performance Optimization Patterns

### 1. Memoization
```typescript
// Memoized components for expensive renders
const MemoizedComponent = memo(Component)

// Memoized values
const expensiveValue = useMemo(() => 
  computeExpensiveValue(data), [data]
)

// Memoized callbacks
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies])
```

### 2. Lazy Loading
```typescript
// Dynamic imports for code splitting
const LazyComponent = lazy(() => import('./HeavyComponent'))

// Usage with Suspense
<Suspense fallback={<LoadingDialog loading={true} />}>
  <LazyComponent />
</Suspense>
```

### 3. Virtual Scrolling
Used in lists with large datasets (messages, user lists) to maintain performance.

## Testing Patterns

### Component Testing Structure
```typescript
// Component.test.tsx
describe('Component', () => {
  const defaultProps = {
    // Default props
  }
  
  const renderComponent = (props = {}) => 
    render(<Component {...defaultProps} {...props} />)
  
  it('should render correctly', () => {
    renderComponent()
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
  
  it('should handle user interaction', async () => {
    renderComponent()
    await user.click(screen.getByRole('button'))
    // Assertions
  })
})
```

This component architecture provides a scalable, maintainable foundation for the CallMiracle application with clear patterns for development and testing.