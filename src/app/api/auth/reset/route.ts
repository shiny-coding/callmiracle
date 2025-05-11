import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { hash } from 'bcrypt'
import { ObjectId } from 'mongodb'

export async function POST(request: NextRequest) {
  const { email, code, newPassword } = await request.json()
  if (!email || !code || !newPassword) return new NextResponse('error', { status: 400 })

  const client = await clientPromise
  const db = client.db()
  const user = await db.collection('users').findOne({ email: email.toLowerCase() })

  if (!user || !user.resetToken || !user.resetTokenTimestamp) {
    return new NextResponse('error', { status: 400 })
  }

  if (user.resetToken !== code) {
    return new NextResponse('error', { status: 400 })
  }

  const hashedPassword = await hash(newPassword, 10)
  await db.collection('users').updateOne(
    { _id: user._id },
    {
      $set: { password: hashedPassword },
      $unset: { resetToken: "", resetTokenTimestamp: "" }
    }
  )

  return new NextResponse('ok')
} 