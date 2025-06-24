# Conversations and Messages Feature

This document describes the implementation of the conversations and messaging system in the application.

## Database Collections

### Conversations Collection
- **Collection name**: `conversations`
- **Purpose**: Stores conversation metadata between two users

**Schema:**
```javascript
{
  _id: ObjectId,
  user1Id: ObjectId,     // First user in the conversation
  user2Id: ObjectId,     // Second user in the conversation
  blockedByUser1: Boolean, // Whether user1 has blocked user2
  blockedByUser2: Boolean, // Whether user2 has blocked user1
  createdAt: Number,     // Timestamp when conversation was created
  updatedAt: Number      // Timestamp when conversation was last updated
}
```

**Indexes:**
- `{ user1Id: 1, user2Id: 1 }` (unique) - Fast lookup of conversation between two users
- `{ user1Id: 1 }` - Find all conversations for user1
- `{ user2Id: 1 }` - Find all conversations for user2
- `{ updatedAt: -1 }` - Sort conversations by last activity

### Messages Collection
- **Collection name**: `messages`
- **Purpose**: Stores individual messages within conversations

**Schema:**
```javascript
{
  _id: ObjectId,
  conversationId: ObjectId, // Reference to the conversation
  userId: ObjectId,         // User who sent the message
  message: String,          // Message content (max 1000 characters)
  createdAt: Number,        // Timestamp when message was created
  updatedAt: Number,        // Timestamp when message was last edited (optional)
  edited: Boolean           // Whether the message has been edited
}
```

**Indexes:**
- `{ conversationId: 1, _id: -1 }` - Primary index for pagination (compound key)
- `{ conversationId: 1 }` - Find all messages in a conversation
- `{ userId: 1 }` - Find all messages by a user
- `{ createdAt: -1 }` - Sort messages by creation time

## GraphQL API

### Types

```graphql
type Conversation {
  _id: ID!
  user1Id: ID!
  user2Id: ID!
  blockedByUser1: Boolean!
  blockedByUser2: Boolean!
  createdAt: Float!
  updatedAt: Float!
  user1: User!
  user2: User!
}

type Message {
  _id: ID!
  conversationId: ID!
  userId: ID!
  message: String!
  createdAt: Float!
  updatedAt: Float
  edited: Boolean!
}
```

### Queries

#### `getConversations`
Returns all conversations for the logged-in user, sorted by last activity (most recent first).

```graphql
query GetConversations {
  getConversations {
    _id
    user1Id
    user2Id
    blockedByUser1
    blockedByUser2
    createdAt
    updatedAt
    user1 {
      _id
      name
    }
    user2 {
      _id
      name
    }
  }
}
```

#### `getMessages`
Returns messages for a specific conversation with pagination support.

**Parameters:**
- `conversationId: ID!` - The conversation to fetch messages from
- `beforeId: ID` - Optional. Fetch messages with IDs less than this (for pagination)

**Returns:** Up to 50 messages, sorted by newest first.

```graphql
query GetMessages($conversationId: ID!, $beforeId: ID) {
  getMessages(conversationId: $conversationId, beforeId: $beforeId) {
    _id
    conversationId
    userId
    message
    createdAt
    updatedAt
    edited
  }
}
```

### Mutations

#### `addMessage`
Sends a new message to a user. Creates a conversation if one doesn't exist.

**Input:**
```graphql
input AddMessageInput {
  targetUserId: ID!    # User to send message to
  message: String!     # Message content (max 1000 characters)
}
```

**Usage:**
```graphql
mutation AddMessage($input: AddMessageInput!) {
  addMessage(input: $input) {
    _id
    conversationId
    userId
    message
    createdAt
  }
}
```

#### `editMessage`
Edits an existing message (only the message owner can edit).

**Input:**
```graphql
input EditMessageInput {
  messageId: ID!     # Message to edit
  message: String!   # New message content
}
```

#### `deleteMessage`
Deletes a message (only the message owner can delete).

**Parameters:**
- `messageId: ID!` - The message to delete

**Returns:** `Boolean!` - Success status

## Constants

### Message Limits
- **MESSAGE_MAX_LENGTH**: 1000 characters
- **MESSAGES_PER_PAGE**: 50 messages per page

## Security Features

1. **Authentication**: All operations require a valid user session
2. **Authorization**: Users can only:
   - View conversations they are part of
   - Send messages to existing users (not themselves)
   - Edit/delete only their own messages
3. **Input Validation**: Message length is validated on both client and server
4. **Data Integrity**: Conversations are automatically created when needed

## Setup Instructions

1. **Setup Database**: Run the comprehensive setup script to create all collections and indexes:
   ```bash
   node scripts/setup-db.mjs
   ```

2. **Environment Variables**: Ensure `MONGODB_URI` is set in your environment

3. **GraphQL Schema**: The schema has been updated with the new types, queries, and mutations

## Implementation Details

- **Conversation Creation**: Conversations are created automatically when the first message is sent between two users
- **Pagination**: Messages use cursor-based pagination with the `beforeId` parameter
- **User Population**: Conversations include populated user data, while messages only include userId for efficiency
- **Timestamps**: All timestamps are stored as Unix timestamps (milliseconds since epoch)
- **Message Editing**: Edited messages are marked with `edited: true` and include an `updatedAt` timestamp 