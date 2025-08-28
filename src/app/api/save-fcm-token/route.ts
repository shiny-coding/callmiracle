import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { fcmTokenRegistrationsMetric, fcmTokenRegistrationFailuresMetric } from '@/utils/metrics'

export async function POST(request: NextRequest) {
  try {
    fcmTokenRegistrationsMetric.add(1)
    
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      fcmTokenRegistrationFailuresMetric.add(1)
      return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const { subscription } = await request.json()
    const userId = session.user.id

    if (!subscription) {
      fcmTokenRegistrationFailuresMetric.add(1)
      return new NextResponse(JSON.stringify({ message: 'Subscription object is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const client = await clientPromise
    const db = client.db()
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $addToSet: { pushSubscriptions: subscription } }
    )

    if (result.modifiedCount === 0 && result.matchedCount === 0) {
      fcmTokenRegistrationFailuresMetric.add(1)
      return new NextResponse(JSON.stringify({ message: 'User not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    return new NextResponse(JSON.stringify({ success: true, message: 'Subscription saved.' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    fcmTokenRegistrationFailuresMetric.add(1)
    console.error('📊 FCM token registration failed:', error)
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
} 