import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { getLogger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  const logger = await getLogger()

  try {
    // Get session to verify user is authenticated
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      logger.warn('Unauthorized attempt to mark notification as seen', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasUserId: !!session?.user?.id
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationId } = body

    if (!notificationId) {
      logger.warn('Missing notificationId in request', {
        userId: session.user.id,
        bodyKeys: Object.keys(body)
      })
      return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Verify the notification belongs to the current user before marking it as seen
    const notification = await db.collection('notifications').findOne({
      _id: new ObjectId(notificationId)
    })

    if (!notification) {
      logger.warn('Notification not found', {
        userId: session.user.id,
        notificationId
      })
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    if (notification.userId.toString() !== session.user.id) {
      logger.warn('User attempted to mark another user\'s notification as seen', {
        userId: session.user.id,
        notificationUserId: notification.userId.toString(),
        notificationId
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Mark notification as seen
    await db.collection('notifications').updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { seen: true } }
    )

    logger.info('Notification marked as seen from push notification click', {
      userId: session.user.id,
      notificationId,
      notificationType: notification.type
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error marking notification as seen', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
