import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getLogger } from '@/utils/logger'

export async function POST(req: NextRequest) {
  // Get logger from AsyncLocalStorage context - no need to pass request
  const logger = await getLogger()
  
  logger.info('Photo upload request received')
  
  try {
    const formData = await req.formData()
    const file = formData.get('photo') as File
    const userId = formData.get('userId')

    logger.info('Photo upload attempt', { 
      userId: userId?.toString(),
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    })

    if (!file || !userId) {
      logger.warn('Photo upload failed: missing file or userId', { 
        hasFile: !!file, 
        hasUserId: !!userId 
      })
      return NextResponse.json({ error: 'Missing file or userId' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      logger.warn('Photo upload failed: invalid file type', { 
        userId: userId.toString(),
        fileType: file.type
      })
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      logger.warn('Photo upload failed: file too large', { 
        userId: userId.toString(),
        fileSize: file.size,
        maxSize
      })
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    logger.debug('Processing image file', { 
      userId: userId.toString(),
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
      userId: userId.toString(),
      originalSize: buffer.length,
      optimizedSize: optimizedBuffer.length,
      compressionRatio: Math.round((1 - optimizedBuffer.length / buffer.length) * 100) + '%'
    })

    // Ensure profiles directory exists
    const profilesDir = path.join(process.cwd(), 'public', 'profiles')
    await mkdir(profilesDir, { recursive: true })
    
    const filePath = path.join(profilesDir, `${userId}.jpg`)
    await writeFile(filePath, optimizedBuffer)

    logger.info('Photo uploaded successfully', { 
      userId: userId.toString(),
      filePath: `/profiles/${userId}.jpg`,
      finalSize: optimizedBuffer.length
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error uploading photo', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
  }
} 