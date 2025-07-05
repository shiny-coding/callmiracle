import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const options = {}

let client
let clientPromise: Promise<MongoClient>

// Function to extract database name from MongoDB URI
export function getDatabaseName(): string {
  if (!uri) {
    throw new Error('MONGODB_URI is not defined')
  }
  
  // Extract database name from URI (after the last /)
  const match = uri.match(/\/([^/?]+)(\?|$)/)
  if (match && match[1]) {
    return match[1]
  }
  
  // Fallback to default database name if not found in URI
  return 'callmiracle'
}

// Check if we're in a build context
const isBuilding = process.env.NEXT_PHASE === 'phase-production-build' || process.argv.includes('build')

// Function to create connection promise with error checking
function createConnection(): Promise<MongoClient> {
  // If we're building and no MongoDB URI is available, return a mock promise
  if (isBuilding && !uri) {
    return Promise.resolve(null as any) // Return a mock client for build time
  }
  
  if (!uri) {
    return Promise.reject(new Error('Please add your Mongo URI to .env.local'))
  }
  
  const mongoClient = new MongoClient(uri, options)
  return mongoClient.connect()
}

// Lazy initialization - only create connection when this module is imported
// and not during build time
if (isBuilding) {
  // During build, use a mock promise that resolves to null
  clientPromise = Promise.resolve(null as any)
} else if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = createConnection()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  clientPromise = createConnection()
}

export default clientPromise 