import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

const dbName = process.env.DB_NAME

if (!dbName) {
  throw new Error('Please define the DB_NAME environment variable')
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      // If not authenticated, redirect to sign in
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const joinToken = searchParams.get('joinToken')

    if (!groupId || !joinToken) {
      return NextResponse.redirect(new URL('/?error=invalid-link', request.url))
    }

    const client = await clientPromise
    const db = client.db(dbName)
    const _userId = new ObjectId(session.user.id)
    const _groupId = new ObjectId(groupId)

    // Find the group and validate the join token
    const group = await db.collection('groups').findOne({ 
      _id: _groupId,
      joinToken: joinToken
    })

    if (!group) {
      return NextResponse.redirect(new URL('/?error=invalid-join-token', request.url))
    }

    // Check if user is already in the group
    const user = await db.collection('users').findOne({ _id: _userId })
    if (user?.groups?.some((id: ObjectId) => id.equals(_groupId))) {
      return NextResponse.redirect(new URL(`/?error=already-in-group&groupId=${groupId}`, request.url))
    }

    // Add user to the group
    await db.collection('users').updateOne(
      { _id: _userId },
      { $addToSet: { groups: _groupId } }
    )

    // Redirect to main page with success parameter
    return NextResponse.redirect(new URL(`/?joinedGroup=${groupId}`, request.url))

  } catch (error) {
    console.error('Error joining group:', error)
    return NextResponse.redirect(new URL('/?error=join-error', request.url))
  }
} 