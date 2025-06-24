// Complete MongoDB database setup script
// This script creates all collections and sets up optimal indexes for the commiracle application

import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI

// All collections in the application
const COLLECTIONS = [
  'users',
  'accounts', 
  'groups',
  'meetings',
  'calls',
  'notifications',
  'conversations',
  'messages'
]

async function setupDatabase() {
  const client = new MongoClient(uri)
  
  try {
    await client.connect()
    console.log('🔗 Connected to MongoDB')
    
    const db = client.db()
    
    // Create all collections first
    await createCollections(db)
    
    // Drop existing indexes (except _id)
    await dropExistingIndexes(db)
    
    // Set up indexes for all collections
    await setupIndexes(db)
    
    console.log('✅ Database setup completed successfully!')
    
  } catch (error) {
    console.error('❌ Error setting up database:', error)
    throw error
  } finally {
    await client.close()
    console.log('🔌 Disconnected from MongoDB')
  }
}

async function createCollections(db) {
  console.log('\n📦 Creating collections...')
  
  for (const collectionName of COLLECTIONS) {
    try {
      await db.createCollection(collectionName)
      console.log(`✓ Created collection: ${collectionName}`)
    } catch (error) {
      if (error.code === 48) {
        console.log(`✓ Collection already exists: ${collectionName}`)
      } else {
        console.error(`✗ Error creating collection ${collectionName}:`, error.message)
      }
    }
  }
}

async function dropExistingIndexes(db) {
  console.log('\n🗑️ Dropping existing indexes...')
  
  for (const collectionName of COLLECTIONS) {
    try {
      console.log(`\nDropping indexes for ${collectionName}:`)
      
      // Get all indexes for the collection
      const indexes = await db.collection(collectionName).listIndexes().toArray()
      
      // Drop all indexes except _id_
      for (const index of indexes) {
        if (index.name !== '_id_') {
          try {
            await db.collection(collectionName).dropIndex(index.name)
            console.log(`✓ Dropped index "${index.name}" from ${collectionName}`)
          } catch (error) {
            if (error.code === 27) {
              console.log(`✓ Index "${index.name}" was already dropped from ${collectionName}`)
            } else {
              console.error(`✗ Error dropping index "${index.name}" from ${collectionName}:`, error.message)
            }
          }
        }
      }
      
      if (indexes.length <= 1) {
        console.log(`✓ No custom indexes to drop in ${collectionName}`)
      }
      
    } catch (error) {
      console.log(`✓ Collection ${collectionName} not found, skipping index drop`)
    }
  }
}

async function setupIndexes(db) {
  console.log('\n🔍 Setting up indexes...')
  
  // Users collection indexes
  console.log('\nUsers indexes:')
  await createIndexSafely(db, 'users', { email: 1 }, { unique: true, name: 'email_unique' })
  await createIndexSafely(db, 'users', { groups: 1 }, { name: 'user_groups' })
  await createIndexSafely(db, 'users', { locale: 1 }, { name: 'users_locale' })
  
  // Accounts collection indexes (for NextAuth)
  console.log('\nAccounts indexes:')
  await createIndexSafely(db, 'accounts', { userId: 1 }, { name: 'account_user' })
  await createIndexSafely(db, 'accounts', { provider: 1, providerAccountId: 1 }, { unique: true, name: 'provider_account_unique' })
  
  // Groups collection indexes
  console.log('\nGroups indexes:')
  await createIndexSafely(db, 'groups', { owner: 1 }, { name: 'group_owner' })
  await createIndexSafely(db, 'groups', { admins: 1 }, { name: 'group_admins' })
  await createIndexSafely(db, 'groups', { joinToken: 1 }, { unique: true, sparse: true, name: 'join_token_unique' })
  
  // Meetings collection indexes
  console.log('\nMeetings indexes:')
  await createIndexSafely(db, 'meetings', { userId: 1, _id: -1 }, { name: 'meeting_user' })
  await createIndexSafely(db, 'meetings', { groupId: 1, lastSlotEnd: 1 }, { name: 'meeting_group_last_slot_end' })
  await createIndexSafely(db, 'meetings', { groupId: 1, userId: 1, lastSlotEnd: 1 }, { name: 'meeting_group_user_last_slot_end' })
  
  // Calls collection indexes
  console.log('\nCalls indexes:')
  await createIndexSafely(db, 'calls', { initiatorUserId: 1 }, { name: 'call_initiator' })
  await createIndexSafely(db, 'calls', { targetUserId: 1 }, { name: 'call_target' })
  await createIndexSafely(db, 'calls', { meetingId: 1 }, { sparse: true, name: 'call_meeting' })
  await createIndexSafely(db, 'calls', { type: 1 }, { name: 'call_type' })
  
  // Composite indexes for call history queries
  await createIndexSafely(db, 'calls', { initiatorUserId: 1, targetUserId: 1 }, { name: 'call_participants' })
  await createIndexSafely(db, 'calls', { targetUserId: 1, initiatorUserId: 1 }, { name: 'call_participants_reverse' })
  
  // Notifications collection indexes
  console.log('\nNotifications indexes:')
  
  await createIndexSafely(db, 'notifications', { userId: 1, seen: 1, _id: -1 }, { name: 'notification_user_seen' })
  await createIndexSafely(db, 'notifications', { userId: 1, createdAt: -1 }, { name: 'notification_user_time' })
  
  // Conversations collection indexes
  console.log('\nConversations indexes:')
  await createIndexSafely(db, 'conversations', { user1Id: 1 }, { name: 'user1_conversations' })
  await createIndexSafely(db, 'conversations', { user2Id: 1 }, { name: 'user2_conversations' })
  
  // Messages collection indexes
  console.log('\nMessages indexes:')
  await createIndexSafely(db, 'messages', { conversationId: 1, _id: -1 }, { name: 'conversation_messages_pagination' })
  await createIndexSafely(db, 'messages', { conversationId: 1 }, { name: 'conversation_messages' })
  await createIndexSafely(db, 'messages', { userId: 1 }, { name: 'user_messages' })
  
  console.log('\n📊 Listing all indexes...')
  await listAllIndexes(db)
}

async function createIndexSafely(db, collectionName, keys, options) {
  try {
    await db.collection(collectionName).createIndex(keys, options)
    console.log(`✓ Created index "${options.name}" on ${collectionName}: ${JSON.stringify(keys)}`)
  } catch (error) {
    if (error.code === 85) {
      console.log(`✓ Index "${options.name}" already exists on ${collectionName}`)
    } else {
      console.error(`✗ Error creating index "${options.name}" on ${collectionName}:`, error.message)
    }
  }
}

async function listAllIndexes(db) {
  for (const collectionName of COLLECTIONS) {
    try {
      const indexes = await db.collection(collectionName).listIndexes().toArray()
      console.log(`\n${collectionName.toUpperCase()} (${indexes.length} indexes):`)
      indexes.forEach(index => {
        const keysStr = JSON.stringify(index.key)
        const options = []
        if (index.unique) options.push('unique')
        if (index.sparse) options.push('sparse')
        const optionsStr = options.length > 0 ? ` [${options.join(', ')}]` : ''
        console.log(`  • ${index.name}: ${keysStr}${optionsStr}`)
      })
    } catch (error) {
      console.log(`\n${collectionName.toUpperCase()}: Collection not found`)
    }
  }
}

// Run the function if this file is executed directly
// Check if this is the main module being run
const isMainModule = process.argv[1] && process.argv[1].endsWith('setup-db.mjs')

if (isMainModule) {
  console.log('🚀 Starting database setup...')
  console.log(`📍 MongoDB URI: ${uri}`)
  setupDatabase().catch((error) => {
    console.error('💥 Setup failed:', error)
    process.exit(1)
  })
}

export { setupDatabase } 