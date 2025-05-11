import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendMail({ to, subject, text }: { to: string, subject: string, text: string }) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  })
}

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email) return new NextResponse('error', { status: 400 })

  const client = await clientPromise
  const db = client.db()
  const user = await db.collection('users').findOne({ email: email.toLowerCase() })

  // Do not reveal if user exists
  if (!user) return new NextResponse('sent')

  const now = Date.now()
  if (user.resetTokenTimestamp && now - user.resetTokenTimestamp < 60_000) {
    return new NextResponse('too-frequently')
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { resetToken: code, resetTokenTimestamp: now } }
  )

  try {
    await sendMail({
      to: email,
      subject: 'Reset password for CallMiracle.com',
      text: code,
    })
    return new NextResponse('sent')
  } catch (err) {
    return new NextResponse('error', { status: 500 })
  }
} 