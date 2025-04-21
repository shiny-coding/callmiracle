import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { hash } from 'bcrypt'
import { getTranslations } from 'next-intl/server'
import { getCurrentLocale } from '@/utils'

export async function POST(req: NextRequest) {
  const locale = getCurrentLocale(req)
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
    
    // Check if user exists with this email but used a social provider
    const existingUser = await db.collection('users').findOne({
      email: email.toLowerCase()
    })
    
    if (existingUser) {
      // Check if they used a social provider
      if (!existingUser.password) {
        const accountsCollection = db.collection("accounts")
        const account = await accountsCollection.findOne({ userId: existingUser._id })
        
        if (account) {
          return NextResponse.json({ 
            error: 'provider_exists', 
            provider: account.provider,
            message: `An account already exists with this email address. Please log in using ${account.provider} instead.` 
          }, { status: 400 })
        }
      }
      
      return NextResponse.json({ error: 'user_exists', message: 'User already exists' }, { status: 400 })
    }
    
    // Hash the password
    const hashedPassword = await hash(password, 10)
    
    const now = new Date()
    // Create the user
    const result = await db.collection('users').insertOne({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      languages: [],
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