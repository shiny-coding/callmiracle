#!/usr/bin/env node

/**
 * Environment validation script for CallMiracle observability
 */

require('dotenv').config({ path: '.env.local' })

function checkEnvironment() {
  console.log('🔧 CallMiracle Environment Check\n')
  
  const requiredVars = [
    'NEXT_PUBLIC_APP_URL',
    'PORT',
    'MONGODB_URI'
  ]
  
  const optionalVars = [
    'OTEL_SERVICE_NAME',
    'OTEL_SERVICE_VERSION', 
    'OTEL_EXPORTER_OTLP_ENDPOINT',
    'NODE_ENV'
  ]
  
  console.log('📋 Required Variables:')
  let hasIssues = false
  
  requiredVars.forEach(varName => {
    const value = process.env[varName]
    if (value) {
      console.log(`✅ ${varName}: ${value}`)
    } else {
      console.log(`❌ ${varName}: MISSING`)
      hasIssues = true
    }
  })
  
  console.log('\n🔧 Optional/OpenTelemetry Variables:')
  optionalVars.forEach(varName => {
    const value = process.env[varName]
    if (value) {
      console.log(`✅ ${varName}: ${value}`)
    } else {
      console.log(`⚠️  ${varName}: Using default`)
    }
  })
  
  // Check port consistency
  console.log('\n🔍 Port Configuration Check:')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const port = process.env.PORT
  
  if (appUrl && port) {
    if (appUrl.includes(`:${port}`)) {
      console.log('✅ Port consistency: NEXT_PUBLIC_APP_URL matches PORT')
    } else {
      console.log('⚠️  Port mismatch: NEXT_PUBLIC_APP_URL and PORT don\'t match')
      console.log(`   APP_URL: ${appUrl}`)
      console.log(`   PORT: ${port}`)
    }
  }
  
  console.log('\n🐳 Expected Docker Services:')
  console.log('- callmiracle-grafana (port 3004)')
  console.log('- callmiracle-loki (port 3100)')
  console.log('- callmiracle-tempo (port 3200)')
  console.log('- callmiracle-otel-collector (ports 4317, 4318, 8888, 8889)')
  
  if (hasIssues) {
    console.log('\n❌ Environment issues detected. Please fix before running.')
    process.exit(1)
  } else {
    console.log('\n✅ Environment check passed!')
  }
}

if (require.main === module) {
  checkEnvironment()
}

module.exports = { checkEnvironment }