#!/usr/bin/env node

/**
 * Enhanced authenticated trace filtering test with real endpoints
 */

const fetch = require('node-fetch')
const { CookieJar } = require('tough-cookie')

const BASE_URL = 'http://localhost:3003'
const PASSWORD = 'passtoacim'

// Your real users with configured sampling rates
const TEST_USERS = [
  { 
    id: '68089748bd844e6669ccf56b',
    name: 'Star', 
    email: 'shinymiracles@gmail.com', 
    expectedRate: 0.05 
  },
  { 
    id: '680ddfae099fda616a050495',
    name: 'Ultra', 
    email: 'serhiichechin@gmail.com', 
    expectedRate: 0.5 
  },
  { 
    id: '685e9d8a5a5d02d979a29df1',
    name: 'iPhone', 
    email: 'my@em.com', 
    expectedRate: 1.0 
  }
]

// Real API endpoints that should work
const REAL_ENDPOINTS = [
  { path: '/api/auth/session', method: 'GET', desc: 'Session check' },
  { path: '/api/log', method: 'POST', desc: 'Log endpoint', 
    body: { level: 'info', message: 'Test log from trace test', userId: null } },
  { path: '/api/update-locale', method: 'POST', desc: 'Locale update',
    body: { locale: 'en' } },
  { 
    path: '/api/graphql', 
    method: 'POST', 
    desc: 'GraphQL users query',
    body: { query: 'query { getUsers { name email } }' }
  },
  { 
    path: '/api/graphql', 
    method: 'POST', 
    desc: 'GraphQL user query',
    body: { query: `query { getUser(userId: "TEST_USER_ID") { name email } }` }
  }
]

const ERROR_ENDPOINT =
{ 
  path: '/api/graphql', 
  method: 'POST', 
  desc: 'GraphQL user query',
  body: { query: `query { getUsers { non_existent_field } }` }
}



class AuthenticatedClient {
  constructor(userName) {
    this.cookies = new CookieJar()
    this.userName = userName
  }

  async login(email, password) {
    console.log(`🔐 ${this.userName}: Logging in as ${email}...`)
    
    try {
      // Get CSRF token
      const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`)
      if (!csrfResponse.ok) {
        throw new Error(`CSRF failed: ${csrfResponse.status}`)
      }
      const csrfData = await csrfResponse.json()
      
      // Extract cookies from CSRF response
      const setCookieHeaders = csrfResponse.headers.raw()['set-cookie']
      if (setCookieHeaders) {
        for (const cookie of setCookieHeaders) {
          await this.cookies.setCookie(cookie, BASE_URL)
        }
      }
      
      // Get current cookies for login request
      const cookieString = await this.cookies.getCookieString(BASE_URL)
      
      // Login with credentials
      const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString
        },
        body: new URLSearchParams({
          csrfToken: csrfData.csrfToken,
          email: email,
          password: password,
          json: 'true'
        })
      })

      // Update cookies from login response
      const loginSetCookieHeaders = loginResponse.headers.raw()['set-cookie']
      if (loginSetCookieHeaders) {
        for (const cookie of loginSetCookieHeaders) {
          await this.cookies.setCookie(cookie, BASE_URL)
        }
      }

      if (loginResponse.ok) {
        console.log(`   ✅ Login successful`)
        return true
      } else {
        console.log(`   ❌ Login failed: ${loginResponse.status}`)
        return false
      }
    } catch (error) {
      console.log(`   ❌ Login error: ${error.message}`)
      return false
    }
  }

  async makeAuthenticatedRequest(endpoint, method = 'GET', body = null) {
    const cookieString = await this.cookies.getCookieString(BASE_URL)
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString,
        'User-Agent': `TraceTest-${this.userName}`
      }
    }
    
    if (body) {
      options.body = JSON.stringify(body)
    }
    
    return fetch(`${BASE_URL}${endpoint}`, options)
  }
}

async function testUserWithRealEndpoints(user, requestCount = 20) {
  console.log(`\n📊 Testing ${user.name} (${user.expectedRate * 100}% sampling)`)
  
  const client = new AuthenticatedClient(user.name)
  const loginSuccess = await client.login(user.email, PASSWORD)
  
  if (!loginSuccess) {
    return { user: user.name, success: 0, error: 1, skipped: true }
  }

  console.log(`   Generating ${requestCount} authenticated requests to real endpoints...`)
  
  const results = { user: user.name, success: 0, error: 0, skipped: false }
  
  for (let i = 0; i < requestCount; i++) {
    try {
      const endpoint = REAL_ENDPOINTS[i % REAL_ENDPOINTS.length]
      let requestBody = endpoint.body
      
      // Replace TEST_USER_ID with actual user ID
      if (requestBody && typeof requestBody === 'object' && requestBody.query) {
        requestBody = {
          ...requestBody,
          query: requestBody.query.replace('TEST_USER_ID', user.id)
        }
      }
      if (requestBody && requestBody.userId === null) {
        requestBody = { ...requestBody, userId: user.id }
      }
      
      const response = await client.makeAuthenticatedRequest(
        endpoint.path, 
        endpoint.method, 
        requestBody
      )
      
      if (response.ok) {
        results.success++
      } else {
        results.error++
      }
      
      // Progress indicator
      if (i % 5 === 0 && i > 0) {
        process.stdout.write('.')
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 150))
      
    } catch (error) {
      results.error++
    }
  }
  
  console.log(`\n   ✅ ${results.success} success, ${results.error} errors`)
  return results
}

async function generateAuthenticatedErrors() {
  console.log('\n🚨 Generating authenticated error traces (should bypass sampling)...')
  
  for (const user of TEST_USERS) {
    const client = new AuthenticatedClient(user.name)
    await client.login(user.email, PASSWORD)
    
    // Generate authenticated 404 error
    try {
      await client.makeAuthenticatedRequest(ERROR_ENDPOINT.path, ERROR_ENDPOINT.method, ERROR_ENDPOINT.body)
      console.log(`   ${user.name}: 404 error generated (authenticated)`)
    } catch (error) {
      console.log(`   ${user.name}: Error request sent`)
    }
  }
}

async function main() {
  console.log('🧪 Enhanced Authenticated Trace Filtering Test')
  console.log('=============================================')
  console.log('Using real API endpoints with proper authentication')
  console.log()
  
  const startTime = Date.now()
  const allResults = []
  
  try {
    // Test each user with real authentication and endpoints
    for (const user of TEST_USERS) {
      const result = await testUserWithRealEndpoints(user, 20)
      allResults.push(result)
    }
    
    // Generate authenticated error traces
    await generateAuthenticatedErrors()
    
    console.log('\n📈 Test Summary:')
    allResults.forEach(result => {
      const user = TEST_USERS.find(u => u.name === result.user)
      if (result.skipped) {
        console.log(`${result.user}: SKIPPED (login failed)`)
      } else {
        console.log(`${result.user}: ${result.success} success, ${result.error} errors (${user.expectedRate * 100}% sampling)`)
      }
    })
    
    console.log('\n⏱️  Waiting 30 seconds for traces to process...')
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    console.log('\n🔍 Grafana Verification (with user context):')
    console.log('Go to Grafana → Explore → Tempo:\n')
    
    TEST_USERS.forEach(user => {
      const expectedTraces = Math.round(20 * user.expectedRate)
      console.log(`📊 ${user.name} (${user.expectedRate * 100}% sampling):`)
      console.log(`   Query: {callmiracle.user_id="${user.id}"}`)
      console.log(`   Expected: ~${expectedTraces} traces from 20 requests`)
      console.log(`   Should now see proper user context in trace attributes\n`)
    })
    
    console.log('🔧 After the fix, traces should now include:')
    console.log('   - callmiracle.user_id with actual user IDs')
    console.log('   - callmiracle.user_name with user names') 
    console.log('   - Proper sampling based on user configuration')
    console.log('')
    console.log('📈 Expected ratio: Star:Ultra:iPhone ≈ 1:10:20')
    console.log('🚨 All users should have error traces (bypass sampling)')
    
    const duration = Date.now() - startTime
    console.log(`\n✅ Enhanced test completed in ${(duration/1000).toFixed(1)}s`)
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

main().catch(console.error)