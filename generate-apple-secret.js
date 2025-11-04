const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Apple configuration from your .env
const TEAM_ID = 'G5D9F99WTN';
const KEY_ID = 'YPJH4J65SS';
const CLIENT_ID = 'net.miracall.signin';
const KEY_FILE = path.join(__dirname, 'keys', 'AuthKey_YPJH4J65SS.p8');

console.log('🔑 Generating new Apple Client Secret...\n');

try {
  // Read the private key
  const privateKey = fs.readFileSync(KEY_FILE, 'utf8');

  const now = Math.floor(Date.now() / 1000);
  const expiryTime = now + 15777000; // 6 months (maximum allowed by Apple)

  // Generate the JWT
  const token = jwt.sign(
    {
      iss: TEAM_ID,
      iat: now,
      exp: expiryTime,
      aud: 'https://appleid.apple.com',
      sub: CLIENT_ID
    },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: KEY_ID
    }
  );

  // Decode to show expiry info
  const decoded = jwt.decode(token);
  const issueDate = new Date(decoded.iat * 1000);
  const expiryDate = new Date(decoded.exp * 1000);

  console.log('✅ Successfully generated new Apple Client Secret!\n');
  console.log('📋 Token Details:');
  console.log('  Team ID:', TEAM_ID);
  console.log('  Key ID:', KEY_ID);
  console.log('  Client ID:', CLIENT_ID);
  console.log('  Issue Date:', issueDate.toISOString());
  console.log('  Expiry Date:', expiryDate.toISOString());
  console.log('  Valid for:', Math.floor((decoded.exp - decoded.iat) / 86400), 'days\n');

  console.log('🔐 New AUTH_APPLE_SECRET:');
  console.log('━'.repeat(80));
  console.log(token);
  console.log('━'.repeat(80));
  console.log('\n📝 Update your .env file with:');
  console.log(`AUTH_APPLE_SECRET="${token}"`);
  console.log('\n⚠️  Remember to:');
  console.log('  1. Update your production .env file');
  console.log('  2. Restart your production server');
  console.log('  3. Verify https://callmiracle.com/api/auth/callback/apple is in Apple Developer Console');

} catch (error) {
  console.error('❌ Error generating client secret:', error.message);
  process.exit(1);
}
