import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { hash } from 'bcrypt'
import { getTranslations } from 'next-intl/server'
import { getCurrentLocale } from '@/utils'
import { getLogger } from '@/utils/logger'

export async function POST(req: NextRequest) {
  // Get logger (reads context from headers set by middleware)
  const logger = await getLogger()
  
  logger.debug('Registration request received')
  
  const locale = getCurrentLocale(req)
  const t = await getTranslations({ locale, namespace: 'Auth' })
  
  try {
    const { name, email, password, defaultLanguages } = await req.json()
    
    logger.info('Registration attempt', { email: email?.toLowerCase(), hasName: !!name, hasPassword: !!password })
    
    // Validate input
    if (!name || !email || !password) {
      logger.warn('Registration failed: missing required fields', { 
        hasName: !!name, 
        hasEmail: !!email, 
        hasPassword: !!password 
      })
      return NextResponse.json(
        { message: t('missingRequiredFields') },
        { status: 400 }
      )
    }
    
    // Connect to MongoDB
    const client = await clientPromise
    const db = client.db()
    
    logger.debug('Connected to database, checking for existing user')
    
    // Check if user exists with this email but used a social provider
    const existingUser = await db.collection('users').findOne({
      email: email.toLowerCase()
    })
    
    if (existingUser) {
      logger.warn('Registration attempt with existing email', { email: email.toLowerCase() })
      
      // Check if they used a social provider
      if (!existingUser.password) {
        const accountsCollection = db.collection("accounts")
        const account = await accountsCollection.findOne({ userId: existingUser._id })
        
        if (account) {
          logger.warn('Registration attempt with existing social provider account', { 
            email: email.toLowerCase(), 
            provider: account.provider 
          })
          return NextResponse.json({ 
            error: 'provider_exists', 
            provider: account.provider,
            message: `An account already exists with this email address. Please log in using ${account.provider} instead.` 
          }, { status: 400 })
        }
      }
      
      logger.warn('Registration attempt with existing email/password account', { email: email.toLowerCase() })
      return NextResponse.json({ error: 'user_exists', message: 'User already exists' }, { status: 400 })
    }
    
    // Hash the password
    logger.debug('Hashing password for new user')
    const hashedPassword = await hash(password, 10)
    
    const now = new Date()
    // Create the user
    logger.info('Creating new user account', { email: email.toLowerCase(), name })
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

    logger.info('User registration successful', { 
      userId: result.insertedId.toString(), 
      email: email.toLowerCase(),
      name
    })

    return NextResponse.json(
      { 
        message: t('registrationSuccess'),
        userId: result.insertedId
      },
      { status: 201 }
    )
    
  } catch (error) {
    logger.error('Registration error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { message: t('registrationError') },
      { status: 500 }
    )
  }
} 