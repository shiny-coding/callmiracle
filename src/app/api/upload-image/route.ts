import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getLogger } from '@/utils/logger'

export async function POST(req: NextRequest) {
  const logger = await getLogger()

  logger.info('Image upload request received')

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File
    const entityId = formData.get('entityId')
    const entityType = formData.get('entityType') as 'user' | 'group'

    logger.info('Image upload attempt', {
      entityId: entityId?.toString(),
      entityType,
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    })

    if (!file || !entityId || !entityType) {
      logger.warn('Image upload failed: missing required fields', {
        hasFile: !!file,
        hasEntityId: !!entityId,
        hasEntityType: !!entityType
      })
      return NextResponse.json({ error: 'Missing file, entityId, or entityType' }, { status: 400 })
    }

    // Validate entity type
    if (entityType !== 'user' && entityType !== 'group') {
      logger.warn('Image upload failed: invalid entity type', {
        entityId: entityId.toString(),
        entityType
      })
      return NextResponse.json({ error: 'entityType must be "user" or "group"' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      logger.warn('Image upload failed: invalid file type', {
        entityId: entityId.toString(),
        fileType: file.type
      })
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      logger.warn('Image upload failed: file too large', {
        entityId: entityId.toString(),
        fileSize: file.size,
        maxSize
      })
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    logger.debug('Processing image file', {
      entityId: entityId.toString(),
      originalSize: file.size
    })

    const buffer = Buffer.from(await file.arrayBuffer())

    // Convert to high quality JPG using sharp
    const optimizedBuffer = await sharp(buffer)
      .jpeg({
        quality: 90,
        mozjpeg: true
      })
      .toBuffer()

    logger.debug('Image optimized', {
      entityId: entityId.toString(),
      originalSize: buffer.length,
      optimizedSize: optimizedBuffer.length,
      compressionRatio: Math.round((1 - optimizedBuffer.length / buffer.length) * 100) + '%'
    })

    // Determine directory based on entity type
    const dirName = entityType === 'user' ? 'profiles' : 'groups'
    const imageDir = path.join(process.cwd(), 'public', dirName)
    await mkdir(imageDir, { recursive: true })

    const filePath = path.join(imageDir, `${entityId}.jpg`)
    await writeFile(filePath, optimizedBuffer)

    logger.info('Image uploaded successfully', {
      entityId: entityId.toString(),
      entityType,
      filePath: `/${dirName}/${entityId}.jpg`,
      finalSize: optimizedBuffer.length
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error uploading image', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
