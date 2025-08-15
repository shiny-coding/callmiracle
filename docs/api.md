# API Documentation

## Overview

CallMiracle uses a hybrid API architecture combining **GraphQL** for complex data operations and **REST endpoints** for specific utility functions. The main API is GraphQL-based with real-time subscriptions support.

## GraphQL API

### Endpoint
- **Development**: `http://localhost:3003/api/graphql`
- **Production**: `https://your-domain.com/api/graphql`
- **GraphiQL**: Available in development with SSE subscriptions support

### Authentication
All GraphQL operations require authentication via NextAuth.js session. The session is automatically passed to resolvers via context.

### Core Schema Structure

#### User Management
```graphql
type User {
  _id: ID!
  name: String!
  email: String!
  languages: [String!]!
  about: String!
  contacts: String!
  sex: String!
  birthYear: Int
  groups: [ID!]!
  friends: [ID!]!
  blocks: [Block!]!
  pushSubscriptions: [PushSubscription]
  logLevel: String
  clientLogLevel: String
  instrumentationConfig: InstrumentationConfig
}

# User queries
getUser(userId: ID!): User
getUsers: [User!]!

# User mutations
updateUser(input: UserInput!): User
deleteUser(userId: ID!): Boolean!
```

#### Group Management
```graphql
type Group {
  _id: ID!
  name: String!
  description: String
  open: Boolean!
  transparency: MeetingTransparency!
  owner: ID!
  admins: [ID!]!
  language: String!
  joinToken: String
  interestsPairs: [[String!]!]!
  interestsDescriptions: [InterestDescription!]!
  usersCount: Int
}

# Group queries
getGroups(userId: ID!): [Group!]!

# Group mutations
createOrUpdateGroup(input: GroupInput!): Group!
regenerateJoinToken(groupId: ID!): Group!
removeUserFromGroup(groupId: ID!, userId: ID!): Boolean!
deleteGroup(id: ID!): Boolean!
```

#### Meeting Management
```graphql
type Meeting {
  _id: ID!
  userId: ID!
  groupId: ID!
  languages: [String!]!
  interests: [String!]!
  timeSlots: [Float!]!
  minDurationM: Int!
  allowedMales: Boolean!
  allowedFemales: Boolean!
  allowedMinAge: Int!
  allowedMaxAge: Int!
  status: MeetingStatus!
  transparency: MeetingTransparency
  # ... additional fields
}

enum MeetingStatus {
  SEEKING
  FOUND
  CALLED
  FINISHED
  CANCELLED
}

# Meeting queries
getMyMeetingsWithPeers(userId: ID!): [MeetingWithPeer!]!
getFutureMeetingsWithPeers(
  userId: ID!
  filterInterests: [String!]
  filterLanguages: [String!]
  filterAllowedMales: Boolean
  filterAllowedFemales: Boolean
  filterMinAge: Int
  filterMaxAge: Int
  filterMinDurationM: Int
  filterGroups: [String!]
): [MeetingWithPeer!]!

# Meeting mutations
createOrUpdateMeeting(input: MeetingInput!): MeetingOutput!
updateMeetingStatus(input: UpdateMeetingStatusInput!): Meeting!
deleteMeeting(id: ID!): DeleteMeetingResponse
```

#### WebRTC Call Management
```graphql
type CallEvent {
  type: String!  # 'offer' | 'answer' | 'ice-candidate' | 'finished' | 'updateMediaState' | 'expired' | 'reconnect'
  offer: String
  answer: String
  iceCandidate: String
  from: User!
  userId: ID
  videoEnabled: Boolean
  audioEnabled: Boolean
  quality: String
  callId: ID
  meetingId: ID
}

# Call mutations
callUser(input: CallUserInput!): CallEvent
```

#### Real-Time Messaging
```graphql
type Conversation {
  _id: ID!
  user1Id: ID!
  user2Id: ID!
  blockedByUser1: Boolean!
  blockedByUser2: Boolean!
  lastMessage: ID
  user1: User!
  user2: User!
}

type Message {
  _id: ID!
  conversationId: ID!
  userId: ID!
  message: String!
  createdAt: Float!
  edited: Boolean!
}

# Conversation queries
getConversations: [Conversation!]!
getMessages(conversationId: ID!, beforeId: ID, afterId: ID): [Message!]!

# Message mutations
addMessage(input: AddMessageInput!): Message!
editMessage(input: EditMessageInput!): Message!
deleteMessage(messageId: ID!): Boolean!
markConversationRead(conversationId: ID!): Boolean!
```

#### Real-Time Subscriptions
```graphql
type Subscription {
  onSubscriptionEvent(userId: ID!): SubscriptionEvent
}

type SubscriptionEvent {
  callEvent: CallEvent
  notificationEvent: NotificationEvent
  broadcastEvent: BroadcastEvent
}

enum NotificationType {
  MEETING_CONNECTED
  MEETING_DISCONNECTED
  MEETING_FINISHED
  MESSAGE_RECEIVED
}
```

### GraphQL Resolvers Structure

**File**: `src/resolvers/index.ts`

```javascript
export const resolvers = {
  Query: {
    ...usersQueries,      // User-related queries
    ...groupsQueries,     // Group-related queries
    ...callsQueries,      // Call history queries
    ...meetingsQueries,   // Meeting queries
    ...notificationsQueries,  // Notification queries
    ...conversationsQueries   // Messaging queries
  },
  Mutation: {
    updateUser: updateUserMutation,
    callUser: callUserMutation,
    ...meetingsMutations,
    ...groupsMutations,
    ...notificationsMutations,
    ...conversationsMutations,
    deleteUser: deleteUserMutation
  },
  Subscription: {
    ...subscriptions
  },
  Date: dateScalar
}
```

### Key Resolver Files
- **`usersQueries.ts`**: User fetching and filtering
- **`groupsQueries.ts`**: Group membership and permissions
- **`meetingsQueries.ts`**: Meeting matching and scheduling
- **`callUserMutation.ts`**: WebRTC signaling
- **`conversationsMutations.ts`**: Real-time messaging
- **`subscriptions.ts`**: Real-time event subscriptions

## REST API Endpoints

### Authentication Endpoints
- **`/api/auth/[...nextauth]`**: NextAuth.js endpoints (signin, signout, session)
- **`/api/auth/register`**: User registration
- **`/api/auth/reset`**: Password reset
- **`/api/auth/send-reset-code`**: Send password reset code

### File Management
- **`POST /api/upload-photo`**: Upload user profile photo
- **`DELETE /api/delete-photo`**: Delete user profile photo
- **`GET /api/profiles/[id]`**: Serve profile images
- **`POST /api/check-image`**: Validate image files

### Utility Endpoints
- **`POST /api/join-group`**: Join group via join token
- **`POST /api/save-fcm-token`**: Save Firebase Cloud Messaging token
- **`POST /api/update-locale`**: Update user locale preference
- **`POST /api/select-server`**: Server selection for load balancing
- **`POST /api/log`**: Client-side logging endpoint

### Administrative
- **`POST /api/admin/instrumentation`**: OpenTelemetry configuration management

## Real-Time Features

### WebRTC Signaling Flow
```javascript
// Caller initiates call
const callResult = await callUser({
  variables: {
    input: {
      targetUserId: "target-user-id",
      initiatorUserId: "caller-user-id",
      type: "offer",
      offer: sdpOffer,
      videoEnabled: true,
      audioEnabled: true
    }
  }
})

// Callee receives via subscription
const subscription = useSubscription(ON_SUBSCRIPTION_EVENT, {
  variables: { userId: currentUser.id }
})

// Exchange continues with answer and ICE candidates
```

### GraphQL Subscriptions (Server-Sent Events)
```javascript
// Subscribe to real-time events
subscription OnSubscriptionEvent($userId: ID!) {
  onSubscriptionEvent(userId: $userId) {
    callEvent {
      type
      from { name }
      offer
      answer
      iceCandidate
    }
    notificationEvent {
      type
      meeting { _id }
      messageText
    }
    broadcastEvent {
      type
    }
  }
}
```

## Error Handling

### GraphQL Errors
- **AuthenticationError**: User not authenticated
- **NotFoundError**: Resource not found
- **ValidationError**: Input validation failed
- **DatabaseError**: Database operation failed

### HTTP Status Codes
- **200**: Success (GraphQL always returns 200, errors in response body)
- **401**: Unauthorized (REST endpoints)
- **403**: Forbidden
- **404**: Not Found
- **500**: Internal Server Error

## Database Schema

### MongoDB Collections
- **`users`**: User profiles and settings
- **`groups`**: Group definitions and membership
- **`meetings`**: Meeting requests and matches
- **`calls`**: Call history and statistics
- **`conversations`**: One-on-one conversation metadata
- **`messages`**: Individual messages
- **`notifications`**: User notifications

### Key Relationships
```javascript
// User belongs to multiple groups
user.groups: [ObjectId] -> groups._id

// Meeting belongs to user and group
meeting.userId: ObjectId -> users._id
meeting.groupId: ObjectId -> groups._id

// Conversation between two users
conversation.user1Id: ObjectId -> users._id
conversation.user2Id: ObjectId -> users._id

// Message belongs to conversation and user
message.conversationId: ObjectId -> conversations._id
message.userId: ObjectId -> users._id
```

## Performance Considerations

### Query Optimization
- **Indexing**: Proper MongoDB indexes on frequently queried fields
- **Pagination**: Implemented for messages and large result sets
- **Filtering**: Server-side filtering to reduce data transfer
- **Caching**: Session caching and MongoDB connection pooling

### Real-Time Optimization
- **Selective Subscriptions**: Users only subscribe to relevant events
- **Event Batching**: Multiple events can be batched in single subscription payload
- **Connection Management**: Automatic reconnection and cleanup

### Security
- **Authentication**: All operations require valid session
- **Authorization**: Users can only access their own data and group data
- **Input Validation**: Strict input validation on all mutations
- **Rate Limiting**: Implemented at middleware level

## Development Tools

### GraphiQL Interface
- Available at `/api/graphql` in development
- Supports subscriptions via Server-Sent Events
- Schema exploration and query testing

### Logging
- Comprehensive request/response logging
- GraphQL operation tracking
- Error logging with context
- OpenTelemetry integration for tracing

## Client Integration

### Apollo Client Setup
**File**: `src/lib/apollo.ts`

```javascript
const client = new ApolloClient({
  uri: '/api/graphql',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { errorPolicy: 'all' },
    query: { errorPolicy: 'all' }
  }
})
```

### Generated Types
**File**: `src/generated/graphql.tsx`

TypeScript types are automatically generated from the GraphQL schema using GraphQL Code Generator, providing full type safety for all operations.