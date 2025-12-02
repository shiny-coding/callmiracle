import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { fcmTokenRegistrationsMetric, fcmTokenRegistrationFailuresMetric } from '@/utils/metrics'
import { getLogger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  const logger = await getLogger()
  
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const { subscription, deviceId } = await request.json()
    const userId = session.user.id

    if (!subscription) {
      fcmTokenRegistrationFailuresMetric.add(1)
      logger.warn('FCM token registration missing subscription', { userId })
      return new NextResponse(JSON.stringify({ message: 'Subscription object is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const client = await clientPromise
    const db = client.db()

    // Remove any existing subscription with the same endpoint OR deviceId to avoid duplicates
    // deviceId helps deduplicate on iOS where endpoint changes on page refresh
    const pullConditions: any[] = [{ endpoint: subscription.endpoint }]
    if (deviceId) {
      pullConditions.push({ deviceId })
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $pull: { pushSubscriptions: { $or: pullConditions } } } as any
    )

    // Add deviceId to subscription object for future deduplication
    const subscriptionWithDeviceId = deviceId
      ? { ...subscription, deviceId }
      : subscription

    // Then add the new subscription
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $push: { pushSubscriptions: subscriptionWithDeviceId } } as any
    )

    if (result.modifiedCount === 0 && result.matchedCount === 0) {
      logger.warn('FCM token registration user not found', { userId })
      return new NextResponse(JSON.stringify({ message: 'User not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Increment the metric when a subscription was saved
    if (result.modifiedCount > 0) {
      fcmTokenRegistrationsMetric.add(1)
      logger.info('FCM token registered successfully', {
        userId,
        subscriptionEndpoint: subscription?.endpoint
      })
    }

    return new NextResponse(JSON.stringify({ success: true, message: 'Subscription saved.' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    fcmTokenRegistrationFailuresMetric.add(1)
    logger.error('FCM token registration failed', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
} 