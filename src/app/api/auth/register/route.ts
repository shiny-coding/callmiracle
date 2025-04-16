import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { hash } from 'bcrypt'
import { getTranslations } from 'next-intl/server'
import { getLocaleFromHeader } from '@/utils'

export async function POST(req: NextRequest) {
  const locale = getLocaleFromHeader(req)
  const t = await getTranslations({ locale, namespace: 'Auth' })
  
  try {
    const { name, email, password, defaultLanguages } = await req.json()
    
    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: t('missingRequiredFields') },
        { status: 400 }
      )
    }
    
    // Connect to MongoDB
    const client = await clientPromise
    const db = client.db()
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({
      email: email.toLowerCase()
    })
    
    if (existingUser) {
      return NextResponse.json(
        { message: t('userExists') },
        { status: 409 }
      )
    }
    
    // Hash the password
    const hashedPassword = await hash(password, 10)
    
    const now = new Date()
    // Create the user
    const result = await db.collection('users').insertOne({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      languages: defaultLanguages,
      locale: defaultLanguages[ 0 ],
      createdAt: now,
      updatedAt: now,
      blocks: [],
      friends: [],
      about: '',
      contacts: '',
      sex: '',
      birthYear: null
    })

    return NextResponse.json(
      { 
        message: t('registrationSuccess'),
        userId: result.insertedId
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { message: t('registrationError') },
      { status: 500 }
    )
  }
} 