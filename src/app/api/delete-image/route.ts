import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { getLogger } from '@/utils/logger'

export async function DELETE(req: NextRequest) {
  const logger = await getLogger()

  try {
    const { entityId, entityType } = await req.json()

    if (!entityId || !entityType) {
      logger.warn('Image deletion missing required fields')
      return NextResponse.json({ error: 'Missing entityId or entityType' }, { status: 400 })
    }

    // Validate entity type
    if (entityType !== 'user' && entityType !== 'group') {
      logger.warn('Image deletion failed: invalid entity type', { entityType })
      return NextResponse.json({ error: 'entityType must be "user" or "group"' }, { status: 400 })
    }

    const dirName = entityType === 'user' ? 'profiles' : 'groups'
    const imagePath = path.join(process.cwd(), 'public', dirName, `${entityId}.jpg`)

    try {
      await unlink(imagePath)
      logger.info('Image deleted successfully', {
        entityId,
        entityType,
        imagePath: path.relative(process.cwd(), imagePath)
      })
      return NextResponse.json({ success: true })
    } catch (error: any) {
      // If file doesn't exist, that's okay - consider it already deleted
      if (error.code === 'ENOENT') {
        logger.info('Image already deleted or does not exist', {
          entityId,
          entityType,
          imagePath: path.relative(process.cwd(), imagePath)
        })
        return NextResponse.json({ success: true })
      }
      throw error
    }
  } catch (error) {
    logger.error('Error deleting image', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}
