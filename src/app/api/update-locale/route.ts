import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { getLogger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  const logger = await getLogger()
  
  try {
    const session = await getServerSession(authOptions)

    // If there's no session, the user is not logged in.
    // We don't create a user, just return a non-error response.
    if (!session || !session.user) {
      logger.info('Locale update attempted without authentication')
      return new NextResponse(JSON.stringify({ message: 'User not authenticated. Locale not updated on server.' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const { locale } = await request.json()
    const userId = session.user.id

    if (!locale) {
      logger.warn('Locale update missing locale parameter', { userId })
      return new NextResponse(JSON.stringify({ message: 'Locale is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const client = await clientPromise
    const db = client.db()
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { locale: locale } }
    )

    if (result.matchedCount === 0) {
      logger.warn('Locale update user not found', { userId, locale })
      return new NextResponse(JSON.stringify({ message: 'User not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    return new NextResponse(JSON.stringify({ success: true, message: 'Locale updated.' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    logger.error('Error updating locale', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
} 