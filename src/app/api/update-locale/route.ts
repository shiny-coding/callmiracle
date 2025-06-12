import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // If there's no session, the user is not logged in.
    // We don't create a user, just return a non-error response.
    if (!session || !session.user) {
      return new NextResponse(JSON.stringify({ message: 'User not authenticated. Locale not updated on server.' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const { locale } = await request.json()
    const userId = session.user.id

    if (!locale) {
      return new NextResponse(JSON.stringify({ message: 'Locale is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const client = await clientPromise
    const db = client.db()
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { locale: locale } }
    )

    if (result.matchedCount === 0) {
        return new NextResponse(JSON.stringify({ message: 'User not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    return new NextResponse(JSON.stringify({ success: true, message: 'Locale updated.' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Error updating locale:', error)
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
} 