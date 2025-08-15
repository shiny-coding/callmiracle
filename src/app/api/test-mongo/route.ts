import { NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'

export async function GET() {
  console.log('🧪 Starting MongoDB test endpoint...')
  
  try {
    // Test MongoDB operations
    const collection = await getCollection('test_otel')
    
    // Insert a test document
    console.log('📝 Inserting test document...')
    const insertResult = await collection.insertOne({
      test: true,
      timestamp: new Date(),
      endpoint: '/api/test-mongo',
      message: 'MongoDB test from API endpoint'
    })
    
    // Find documents
    console.log('🔍 Finding test documents...')
    const findResult = await collection.find({ test: true }).limit(3).toArray()
    
    // Count documents  
    console.log('📊 Counting documents...')
    const countResult = await collection.countDocuments({ test: true })
    
    // Clean up
    console.log('🗑️ Cleaning up test document...')
    await collection.deleteOne({ _id: insertResult.insertedId })
    
    console.log('✅ MongoDB test completed successfully')
    
    return NextResponse.json({
      success: true,
      results: {
        inserted: insertResult.insertedId,
        found: findResult.length,
        count: countResult,
        cleanup: 'completed'
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ MongoDB test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}