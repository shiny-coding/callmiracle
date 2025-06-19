import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

const dbName = process.env.DB_NAME

if (!dbName) {
  throw new Error('Please define the DB_NAME environment variable')
}

function getLocaleFromRequest(request: NextRequest): string {
  // Try to get locale from Accept-Language header or cookies
  const acceptLanguage = request.headers.get('accept-language')
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
  
  // Prefer cookie locale, fallback to browser language, then default to 'en'
  if (cookieLocale && ['en', 'ru'].includes(cookieLocale)) {
    return cookieLocale
  }
  
  if (acceptLanguage?.includes('ru')) {
    return 'ru'
  }
  
  return 'en'
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const locale = getLocaleFromRequest(request)
    
    if (!session?.user?.id) {
      // If not authenticated, redirect to sign in
      return NextResponse.redirect(new URL(`/${locale}/auth/signin`, request.url))
    }

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const joinToken = searchParams.get('joinToken')

    if (!groupId || !joinToken) {
      return NextResponse.redirect(new URL(`/${locale}/calendar?messageKey=invalidJoinLink&messageType=error`, request.url))
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
      return NextResponse.redirect(new URL(`/${locale}/calendar?messageKey=invalidJoinToken&messageType=error`, request.url))
    }

    // Check if user is already in the group
    const user = await db.collection('users').findOne({ _id: _userId })
    if (user?.groups?.some((id: ObjectId) => id.equals(_groupId))) {
      return NextResponse.redirect(new URL(`/${locale}/calendar?messageKey=alreadyInGroup&messageType=info&groupName=${encodeURIComponent(group.name)}`, request.url))
    }

    // Add user to the group
    await db.collection('users').updateOne(
      { _id: _userId },
      { $addToSet: { groups: _groupId } }
    )

    console.log('User joined group:', user?.name, 'Group:', group.name)

    // Redirect to calendar page with success message
    return NextResponse.redirect(new URL(`/${locale}/calendar?messageKey=youveJoined&messageType=success&groupName=${encodeURIComponent(group.name)}`, request.url))

  } catch (error) {
    console.error('Error joining group:', error)
    const locale = getLocaleFromRequest(request)
    return NextResponse.redirect(new URL(`/${locale}/calendar?messageKey=joinError&messageType=error`, request.url))
  }
} 