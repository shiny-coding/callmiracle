const { execSync } = require('child_process')
const { mkdirSync, existsSync } = require('fs')
const path = require('path')

const certsDir = path.join(__dirname, '../certs')

if (!existsSync(certsDir)) {
  mkdirSync(certsDir)
}

console.log('Generating SSL certificates...')

try {
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' \
    -keyout ${path.join(certsDir, 'localhost-key.pem')} \
    -out ${path.join(certsDir, 'localhost.pem')}`)
  
  console.log('SSL certificates generated successfully in /certs directory')
} catch (error) {
  console.error('Error generating certificates:', error)
  process.exit(1)
} 