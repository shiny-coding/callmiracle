# Development Guide

## Setup and Installation

### Prerequisites
- **Node.js**: Version 18+ recommended
- **Yarn**: Package manager
- **MongoDB**: Local installation or MongoDB Atlas
- **Docker**: For observability stack (optional)

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd callmiracle

# Install dependencies
yarn install

# Environment setup
cp .env.example .env.local
# Edit .env.local with your configuration

# Database setup (if using local MongoDB)
yarn run setup-db

# Start development server
yarn dev
```

### Environment Configuration
```bash
# .env.local
NEXTAUTH_URL=http://localhost:3003
NEXTAUTH_SECRET=your-secret-key
MONGODB_URI=mongodb://localhost:27017/callmiracle
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Development Commands

### Core Commands
```bash
yarn dev          # Start development server on port 3003
yarn build        # Build for production
yarn start        # Start production server
yarn lint         # Run ESLint
yarn typecheck    # Run TypeScript checks
```

### Database Commands
```bash
yarn setup-db     # Initialize database schema
```

### Docker Commands
```bash
# Full application stack
yarn docker:up    # Start app in Docker
yarn docker:down  # Stop Docker containers
yarn docker:logs  # View application logs

# Observability stack
yarn observability:up     # Start monitoring stack
yarn observability:down   # Stop monitoring stack
yarn observability:logs   # View observability logs

# Scaling setup
yarn scale:up      # Start load-balanced setup
yarn scale:down    # Stop scaling setup
```

### Utility Commands
```bash
yarn kill-port    # Kill processes on development ports
yarn codegen      # Generate GraphQL types
```

## Development Workflow

### 1. Feature Development Process
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Start development server
yarn dev

# 3. Make changes with hot reload
# Edit files in src/

# 4. Run type checking
yarn typecheck

# 5. Run linting
yarn lint

# 6. Test changes
# Manual testing at http://localhost:3003

# 7. Commit changes
git add .
git commit -m "feat: add new feature"

# 8. Push and create PR
git push origin feature/new-feature
```

### 2. Code Quality Checks
```bash
# Before committing, run:
yarn typecheck     # Check TypeScript types
yarn lint          # Check code style
yarn build         # Ensure build succeeds
```

### 3. Database Development
```bash
# Connect to local MongoDB
mongosh callmiracle

# View collections
show collections

# Query users
db.users.find().limit(5)

# Query groups
db.groups.find().limit(5)
```

## Project Structure

### Directory Organization
```
callmiracle/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/          # Internationalized routes
│   │   ├── api/               # API routes
│   │   └── globals.scss       # Global styles
│   ├── components/            # React components
│   ├── hooks/                 # Custom hooks
│   │   └── webrtc/           # WebRTC hooks
│   ├── lib/                   # Core libraries
│   ├── resolvers/             # GraphQL resolvers
│   ├── schema/                # GraphQL schema
│   ├── store/                 # State management
│   ├── contexts/              # React contexts
│   ├── utils/                 # Utility functions
│   └── generated/             # Generated GraphQL types
├── public/                    # Static assets
├── observability/             # Monitoring configuration
├── docs/                      # Documentation
└── scripts/                   # Build and utility scripts
```

### File Naming Conventions
- **Components**: PascalCase (`UserCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useUpdateUser.ts`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_ENDPOINTS.ts`)
- **Types**: PascalCase interfaces/types (`UserType.ts`)

## GraphQL Development

### Schema-First Development
1. **Define Schema**: Edit `src/schema/schema.graphql`
2. **Generate Types**: Run `yarn codegen`
3. **Implement Resolvers**: Create resolver functions
4. **Test Operations**: Use GraphiQL at `/api/graphql`

### Adding New Operations
```graphql
# 1. Add to schema.graphql
type NewType {
  id: ID!
  name: String!
}

extend type Query {
  getNewType(id: ID!): NewType
}

extend type Mutation {
  createNewType(input: NewTypeInput!): NewType
}
```

```typescript
// 2. Create resolver
export const newTypeResolvers = {
  getNewType: async (_: any, { id }: { id: string }, { db }: Context) => {
    return await db.collection('newTypes').findOne({ _id: new ObjectId(id) })
  },
  
  createNewType: async (_: any, { input }: { input: NewTypeInput }, { db }: Context) => {
    const result = await db.collection('newTypes').insertOne(input)
    return { _id: result.insertedId, ...input }
  }
}
```

```typescript
// 3. Add to resolver index
import { newTypeResolvers } from './newTypeResolvers'

export const resolvers = {
  Query: {
    ...existingQueries,
    ...newTypeResolvers
  }
}
```

```bash
# 4. Generate types
yarn codegen
```

### GraphQL Best Practices
- **Pagination**: Use cursor-based pagination for lists
- **Error Handling**: Return structured errors with context
- **Authentication**: Check authentication in all resolvers
- **Performance**: Use DataLoader for N+1 query prevention
- **Validation**: Validate inputs thoroughly

## Component Development

### Component Structure Template
```typescript
import { useState, useEffect } from 'react'
import { Card, CardContent, Button } from '@mui/material'
import { useStore } from '@/store/useStore'
import type { User } from '@/generated/graphql'

interface MyComponentProps {
  user: User
  onAction?: (actionType: string) => void
  className?: string
}

export default function MyComponent({ 
  user, 
  onAction, 
  className = '' 
}: MyComponentProps) {
  // State
  const [loading, setLoading] = useState(false)
  
  // Store
  const currentUser = useStore(state => state.currentUser)
  
  // Effects
  useEffect(() => {
    // Side effects
  }, [user])
  
  // Handlers
  const handleClick = async () => {
    setLoading(true)
    try {
      await onAction?.('click')
    } finally {
      setLoading(false)
    }
  }
  
  // Render
  return (
    <Card className={`user-card ${className}`}>
      <CardContent>
        <h3>{user.name}</h3>
        <Button 
          onClick={handleClick}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Action'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

### Hook Development
```typescript
import { useState, useCallback } from 'react'
import { useMutation } from '@apollo/client'
import { UPDATE_USER } from '@/graphql/mutations'
import type { User, UserInput } from '@/generated/graphql'

interface UseUpdateUserResult {
  updateUser: (input: UserInput) => Promise<User | null>
  loading: boolean
  error: Error | null
}

export function useUpdateUser(): UseUpdateUserResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [updateUserMutation] = useUpdateUserMutation()
  
  const updateUser = useCallback(async (input: UserInput): Promise<User | null> => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await updateUserMutation({
        variables: { input }
      })
      return result.data?.updateUser || null
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Update failed')
      setError(error)
      return null
    } finally {
      setLoading(false)
    }
  }, [updateUserMutation])
  
  return { updateUser, loading, error }
}
```

## State Management

### Zustand Store Patterns
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  currentUser: User | null
  preferences: UserPreferences
  
  // Actions
  setCurrentUser: (user: User | null) => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  
  // Computed
  isAuthenticated: () => boolean
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      preferences: defaultPreferences,
      
      setCurrentUser: (user) => set({ currentUser: user }),
      
      updatePreferences: (newPreferences) => 
        set(state => ({
          preferences: { ...state.preferences, ...newPreferences }
        })),
      
      isAuthenticated: () => get().currentUser !== null
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({ 
        preferences: state.preferences 
      }) // Only persist preferences
    }
  )
)
```

### Context Patterns
```typescript
interface FeatureContextType {
  data: FeatureData[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const FeatureContext = createContext<FeatureContextType | null>(null)

export function FeatureProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FeatureData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchFeatureData()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fetch failed'))
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    refetch()
  }, [refetch])
  
  const value = { data, loading, error, refetch }
  
  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  )
}

export function useFeature() {
  const context = useContext(FeatureContext)
  if (!context) {
    throw new Error('useFeature must be used within FeatureProvider')
  }
  return context
}
```

## Authentication Development

### NextAuth.js Configuration
```typescript
// src/app/api/auth/[...nextauth]/options.ts
export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Implement authentication logic
        return user
      }
    })
  ],
  
  adapter: MongoDBAdapter(clientPromise),
  
  callbacks: {
    async session({ session, token }) {
      // Add user ID to session
      if (token.sub) {
        session.user.id = token.sub
      }
      return session
    }
  },
  
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout'
  }
}
```

### Authentication Hooks
```typescript
export function useAuth() {
  const { data: session, status } = useSession()
  
  return {
    user: session?.user || null,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    signIn: () => signIn(),
    signOut: () => signOut()
  }
}
```

## Testing Strategies

### Component Testing
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'
import UserCard from '../UserCard'

const mockUser = {
  _id: '1',
  name: 'Test User',
  email: 'test@example.com'
}

const mocks = [
  {
    request: {
      query: UPDATE_USER,
      variables: { input: { _id: '1', name: 'Updated Name' } }
    },
    result: {
      data: { updateUser: { ...mockUser, name: 'Updated Name' } }
    }
  }
]

describe('UserCard', () => {
  it('displays user information', () => {
    render(
      <MockedProvider mocks={mocks}>
        <UserCard user={mockUser} />
      </MockedProvider>
    )
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })
  
  it('handles user updates', async () => {
    const onUpdate = jest.fn()
    
    render(
      <MockedProvider mocks={mocks}>
        <UserCard user={mockUser} onUpdate={onUpdate} />
      </MockedProvider>
    )
    
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Name'
      }))
    })
  })
})
```

### API Testing
```typescript
// Test GraphQL resolvers
import { createTestContext } from '../test-utils'

describe('User Resolvers', () => {
  it('gets user by ID', async () => {
    const context = await createTestContext()
    
    const result = await userResolvers.getUser(
      null,
      { userId: 'test-user-id' },
      context
    )
    
    expect(result).toMatchObject({
      _id: 'test-user-id',
      name: expect.any(String),
      email: expect.any(String)
    })
  })
})
```

## Debugging

### Development Tools
- **Next.js DevTools**: Built-in development overlay
- **GraphiQL**: Interactive GraphQL explorer at `/api/graphql`
- **React DevTools**: Browser extension for React debugging
- **Apollo Client DevTools**: GraphQL state inspection

### Logging During Development
```typescript
import clientLogger from '@/utils/clientLogger'

// Client-side logging
clientLogger.info('User action', { 
  userId: user.id, 
  action: 'click' 
})

// Server-side logging
const logger = await getLogger()
logger.info('Processing request', { 
  operationName: 'getUsers',
  userId: session?.user?.id 
})
```

### Common Debugging Scenarios
1. **WebRTC Issues**: Check browser console for ICE candidate errors
2. **Authentication Problems**: Verify environment variables and session state
3. **GraphQL Errors**: Use GraphiQL to test queries in isolation
4. **State Management**: Use Zustand DevTools for state inspection
5. **Performance Issues**: Use React Profiler and Network tab

## Performance Optimization

### Bundle Analysis
```bash
# Analyze bundle size
ANALYZE=true yarn build

# Check for unused dependencies
npx depcheck

# Audit packages
yarn audit
```

### Code Splitting
```typescript
// Lazy load components
const HeavyComponent = lazy(() => import('./HeavyComponent'))

// Use dynamic imports for utilities
const heavyUtility = await import('@/utils/heavyUtility')
```

### Image Optimization
```typescript
import Image from 'next/image'

// Optimized images
<Image
  src="/profile.jpg"
  alt="Profile"
  width={200}
  height={200}
  priority={false}
  placeholder="blur"
/>
```

This development guide provides the foundation for efficient development workflows and maintaining code quality throughout the project lifecycle.