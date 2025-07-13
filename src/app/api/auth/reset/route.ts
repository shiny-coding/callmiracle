import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { hash } from 'bcrypt'
import { getLogger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  const logger = await getLogger() 
  
  
  try {
    const { email, code, newPassword } = await request.json()
    
    logger.info('Password reset attempt', { email: email?.toLowerCase(), hasCode: !!code, hasNewPassword: !!newPassword })
    
    if (!email || !code || !newPassword) {
      logger.warn('Password reset failed: missing required fields', { 
        hasEmail: !!email, 
        hasCode: !!code, 
        hasNewPassword: !!newPassword 
      })
      return new NextResponse('error', { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    
    logger.debug('Connected to database, looking up user for password reset')
    const user = await db.collection('users').findOne({ email: email.toLowerCase() })

    if (!user) {
      logger.warn('Password reset failed: user not found', { email: email.toLowerCase() })
      return new NextResponse('error', { status: 400 })
    }
    
    if (!user.resetToken || !user.resetTokenTimestamp) {
      logger.warn('Password reset failed: no reset token found', { 
        email: email.toLowerCase(),
        userId: user._id.toString(),
        hasResetToken: !!user.resetToken,
        hasResetTokenTimestamp: !!user.resetTokenTimestamp
      })
      return new NextResponse('error', { status: 400 })
    }

    if (user.resetToken !== code) {
      logger.warn('Password reset failed: invalid reset code', { 
        email: email.toLowerCase(),
        userId: user._id.toString()
      })
      return new NextResponse('error', { status: 400 })
    }

    // Check if token is expired (assuming 1 hour expiry)
    const tokenAge = Date.now() - user.resetTokenTimestamp.getTime()
    const maxAge = 60 * 60 * 1000 // 1 hour
    if (tokenAge > maxAge) {
      logger.warn('Password reset failed: token expired', { 
        email: email.toLowerCase(),
        userId: user._id.toString(),
        tokenAge: Math.round(tokenAge / 1000 / 60) + ' minutes'
      })
      return new NextResponse('error', { status: 400 })
    }

    logger.debug('Hashing new password for user', { userId: user._id.toString() })
    const hashedPassword = await hash(newPassword, 10)
    
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword },
        $unset: { resetToken: "", resetTokenTimestamp: "" }
      }
    )

    logger.info('Password reset successful', { 
      email: email.toLowerCase(),
      userId: user._id.toString()
    })

    return new NextResponse('ok')
  } catch (error) {
    logger.error('Password reset error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return new NextResponse('error', { status: 500 })
  }
} 