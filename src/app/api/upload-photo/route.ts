import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('photo') as File
    const userId = formData.get('userId')

    if (!file || !userId) {
      return NextResponse.json({ error: 'Missing file or userId' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Convert to high quality JPG using sharp
    const optimizedBuffer = await sharp(buffer)
      .jpeg({
        quality: 90,
        mozjpeg: true
      })
      .toBuffer()

    // Ensure profiles directory exists
    const profilesDir = path.join(process.cwd(), 'public', 'profiles')
    await mkdir(profilesDir, { recursive: true })
    await writeFile(path.join(profilesDir, `${userId}.jpg`), optimizedBuffer)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
  }
} 