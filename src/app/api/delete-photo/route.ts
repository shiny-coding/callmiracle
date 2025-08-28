import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { getLogger } from '@/utils/logger'

export async function DELETE(req: NextRequest) {
  const logger = await getLogger()
  
  try {
    const { userId } = await req.json()

    if (!userId) {
      logger.warn('Photo deletion missing userId')
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const photoPath = path.join(process.cwd(), 'public', 'profiles', `${userId}.jpg`)
    
    try {
      await unlink(photoPath)
      logger.info('Photo deleted successfully', { 
        userId, 
        photoPath: path.relative(process.cwd(), photoPath)
      })
      return NextResponse.json({ success: true })
    } catch (error: any) {
      // If file doesn't exist, that's okay - consider it already deleted
      if (error.code === 'ENOENT') {
        logger.info('Photo already deleted or does not exist', { 
          userId,
          photoPath: path.relative(process.cwd(), photoPath)
        })
        return NextResponse.json({ success: true })
      }
      throw error
    }
  } catch (error) {
    logger.error('Error deleting photo', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
} 