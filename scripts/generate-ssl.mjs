import { execSync } from 'child_process'
import { mkdirSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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