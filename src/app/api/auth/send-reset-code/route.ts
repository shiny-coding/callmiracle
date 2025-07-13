import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import nodemailer from 'nodemailer'
import { getLogger } from '@/utils/logger'

const transporter = nodemailer.createTransport({
  sendmail: process.env.SMTP_SENDMAIL === 'true',
  path: process.env.SMTP_SENDMAIL_PATH,
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
} as any)

async function sendMail({ to, subject, text, logger }: { to: string, subject: string, text: string, logger: any }) {
  logger.info('Sending email', { to, subject })
  
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    })
    logger.info('Email sent successfully', { to, subject })
  } catch (error) {
    logger.error('Failed to send email', { 
      to, 
      subject,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

export async function POST(request: NextRequest) {
  const logger = await getLogger()
  
  logger.info('Password reset code request received')
  
  try {
    const { email } = await request.json()
    
    logger.info('Reset code request attempt', { email: email?.toLowerCase() })
    
    if (!email) {
      logger.warn('Reset code request failed: missing email')
      return new NextResponse('error', { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    
    logger.debug('Connected to database, looking up user for reset code')
    const user = await db.collection('users').findOne({ email: email.toLowerCase() })

    // Do not reveal if user exists (but log it)
    if (!user) {
      logger.info('Reset code requested for non-existent user', { email: email.toLowerCase() })
      return new NextResponse('sent')
    }

    const now = Date.now()
    if (user.resetTokenTimestamp && now - user.resetTokenTimestamp < 60_000) {
      logger.warn('Reset code requested too frequently', { 
        email: email.toLowerCase(),
        userId: user._id.toString(),
        lastRequestAge: Math.round((now - user.resetTokenTimestamp) / 1000) + ' seconds'
      })
      return new NextResponse('too-frequently')
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    
    logger.debug('Generated reset code, updating user record', { 
      userId: user._id.toString(),
      email: email.toLowerCase()
    })
    
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { resetToken: code, resetTokenTimestamp: now } }
    )

    await sendMail({
      to: email,
      subject: 'Reset password for CallMiracle.com',
      text: code,
      logger
    })
    
    logger.info('Reset code sent successfully', { 
      email: email.toLowerCase(),
      userId: user._id.toString()
    })
    
    return new NextResponse('sent')
  } catch (error) {
    logger.error('Error sending reset code', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return new NextResponse('error', { status: 500 })
  }
} 