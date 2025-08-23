#!/usr/bin/env node

/**
 * Script to manage user instrumentation configurations
 * 
 * Usage examples:
 * node scripts/manage-instrumentation.js stats
 * node scripts/manage-instrumentation.js apply-preset user123 standard
 * node scripts/manage-instrumentation.js bulk-apply admin admin-users
 * node scripts/manage-instrumentation.js reset user123
 * node scripts/manage-instrumentation.js high-volume
 */

import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/callmiracle'

const PRESETS = {
  minimal: {
    samplingRate: 0.05,
    enableTracing: true,
    enableMetrics: false,
    instrumentations: { http: true, graphql: false, mongodb: false, webrtc: false }
  },
  standard: {
    samplingRate: 0.1,
    enableTracing: true,
    enableMetrics: false,
    instrumentations: { http: true, graphql: true, mongodb: false, webrtc: false }
  },
  detailed: {
    samplingRate: 0.5,
    enableTracing: true,
    enableMetrics: true,
    instrumentations: { http: true, graphql: true, mongodb: true, webrtc: false }
  },
  admin: {
    samplingRate: 1.0,
    enableTracing: true,
    enableMetrics: true,
    instrumentations: { http: true, graphql: true, mongodb: true, webrtc: true }
  }
}

async function connectToDatabase() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  return client.db()
}

async function getStats() {
  const db = await connectToDatabase()
  const usersCollection = db.collection('users')
  
  const totalUsers = await usersCollection.countDocuments()
  const usersWithConfig = await usersCollection.countDocuments({ instrumentationConfig: { $exists: true } })
  
  const usersWithInstrumentation = await usersCollection.find(
    { instrumentationConfig: { $exists: true } },
    { projection: { instrumentationConfig: 1 } }
  ).toArray()

  const presetDistribution = {}
  const enabledInstrumentations = { http: 0, graphql: 0, mongodb: 0, webrtc: 0 }
  let totalSamplingRate = 0

  for (const user of usersWithInstrumentation) {
    const config = user.instrumentationConfig
    
    // Determine preset
    let matchedPreset = 'custom'
    for (const [presetName, preset] of Object.entries(PRESETS)) {
      if (JSON.stringify(config) === JSON.stringify(preset)) {
        matchedPreset = presetName
        break
      }
    }
    
    presetDistribution[matchedPreset] = (presetDistribution[matchedPreset] || 0) + 1
    totalSamplingRate += config.samplingRate
    
    Object.entries(config.instrumentations).forEach(([key, enabled]) => {
      if (enabled && key in enabledInstrumentations) {
        enabledInstrumentations[key]++
      }
    })
  }

  console.log('\n📊 Instrumentation Statistics:')
  console.log(`Total users: ${totalUsers}`)
  console.log(`Users with custom config: ${usersWithConfig}`)
  console.log(`Average sampling rate: ${usersWithConfig > 0 ? (totalSamplingRate / usersWithConfig).toFixed(3) : 0}`)
  console.log('\nPreset Distribution:')
  Object.entries(presetDistribution).forEach(([preset, count]) => {
    console.log(`  ${preset}: ${count}`)
  })
  console.log('\nEnabled Instrumentations:')
  Object.entries(enabledInstrumentations).forEach(([inst, count]) => {
    console.log(`  ${inst}: ${count} users`)
  })
}

async function applyPreset(userId, presetName) {
  if (!PRESETS[presetName]) {
    console.error(`❌ Unknown preset: ${presetName}`)
    console.log(`Available presets: ${Object.keys(PRESETS).join(', ')}`)
    return
  }

  const db = await connectToDatabase()
  const usersCollection = db.collection('users')
  
  const result = await usersCollection.updateOne(
    { _id: userId },
    { 
      $set: { 
        instrumentationConfig: PRESETS[presetName],
        updatedAt: Date.now()
      } 
    }
  )

  if (result.matchedCount === 0) {
    console.error(`❌ User not found: ${userId}`)
  } else {
    console.log(`✅ Applied ${presetName} preset to user ${userId}`)
  }
}

async function bulkApplyPreset(presetName, criteria) {
  if (!PRESETS[presetName]) {
    console.error(`❌ Unknown preset: ${presetName}`)
    return
  }

  const db = await connectToDatabase()
  const usersCollection = db.collection('users')
  
  let query = {}
  if (criteria === 'admin-users') {
    query.email = { $regex: '@(admin|dev|support)', $options: 'i' }
  } else if (criteria === 'all-users') {
    query = {}
  } else {
    console.error(`❌ Unknown criteria: ${criteria}`)
    return
  }

  const users = await usersCollection.find(query, { projection: { _id: 1, email: 1 } }).toArray()
  
  console.log(`Found ${users.length} users matching criteria: ${criteria}`)
  
  let applied = 0
  for (const user of users) {
    try {
      await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            instrumentationConfig: PRESETS[presetName],
            updatedAt: Date.now()
          } 
        }
      )
      console.log(`✅ Applied ${presetName} to ${user.email}`)
      applied++
    } catch (error) {
      console.error(`❌ Failed to apply to ${user.email}:`, error.message)
    }
  }
  
  console.log(`\n📊 Applied preset to ${applied}/${users.length} users`)
}

async function resetConfig(userId) {
  const db = await connectToDatabase()
  const usersCollection = db.collection('users')
  
  const result = await usersCollection.updateOne(
    { _id: userId },
    { 
      $unset: { instrumentationConfig: 1 },
      $set: { updatedAt: Date.now() }
    }
  )

  if (result.matchedCount === 0) {
    console.error(`❌ User not found: ${userId}`)
  } else {
    console.log(`✅ Reset instrumentation config for user ${userId}`)
  }
}

async function getHighVolumeUsers() {
  const db = await connectToDatabase()
  const usersCollection = db.collection('users')
  
  const highVolumeUsers = await usersCollection.find({
    $or: [
      { 'instrumentationConfig.samplingRate': { $gte: 0.5 } },
      { 'instrumentationConfig.instrumentations.webrtc': true },
      { 'instrumentationConfig.instrumentations.mongodb': true }
    ]
  }, {
    projection: { _id: 1, email: 1, instrumentationConfig: 1 }
  }).toArray()

  console.log('\n🔥 High-Volume Instrumentation Users:')
  console.log(`Found ${highVolumeUsers.length} users with high instrumentation`)
  
  highVolumeUsers.forEach(user => {
    const config = user.instrumentationConfig
    const enabled = Object.entries(config.instrumentations)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name)
    
    console.log(`\n📧 ${user.email} (${user._id})`)
    console.log(`   Sampling: ${(config.samplingRate * 100).toFixed(1)}%`)
    console.log(`   Enabled: ${enabled.join(', ')}`)
  })
}

// Main script logic
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  try {
    switch (command) {
      case 'stats':
        await getStats()
        break
      
      case 'apply-preset':
        const userId = args[1]
        const presetName = args[2]
        if (!userId || !presetName) {
          console.error('Usage: apply-preset <userId> <presetName>')
          process.exit(1)
        }
        await applyPreset(userId, presetName)
        break
      
      case 'bulk-apply':
        const bulkPreset = args[1]
        const criteria = args[2]
        if (!bulkPreset || !criteria) {
          console.error('Usage: bulk-apply <presetName> <criteria>')
          console.error('Criteria: admin-users, all-users')
          process.exit(1)
        }
        await bulkApplyPreset(bulkPreset, criteria)
        break
      
      case 'reset':
        const resetUserId = args[1]
        if (!resetUserId) {
          console.error('Usage: reset <userId>')
          process.exit(1)
        }
        await resetConfig(resetUserId)
        break
      
      case 'high-volume':
        await getHighVolumeUsers()
        break
      
      default:
        console.log('📋 Available commands:')
        console.log('  stats                                    - Show instrumentation statistics')
        console.log('  apply-preset <userId> <preset>          - Apply preset to user')
        console.log('  bulk-apply <preset> <criteria>          - Bulk apply preset')
        console.log('  reset <userId>                          - Reset user config to default')
        console.log('  high-volume                             - Show high-volume users')
        console.log('\n🎛️  Available presets: ' + Object.keys(PRESETS).join(', '))
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

main()