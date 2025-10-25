# Multi-Domain Setup Guide

This guide explains how to configure CallMiracle to work with multiple domains (e.g., `callmiracle.com` and `call.miracall.net`).

## Overview

CallMiracle is configured to **auto-detect** the domain from incoming requests, allowing it to work seamlessly with multiple domains without hardcoding URLs.

## Configuration Changes Made

### 1. NextAuth Auto-Detection

**File**: `.env.local`

The `NEXTAUTH_URL` variable is now commented out to enable auto-detection:

```env
# NEXTAUTH_URL - Auto-detected from request Host header
# This allows the app to work with multiple domains
# NEXTAUTH_URL=http://localhost:3003
```

**How it works**:
- NextAuth reads the `Host` header from incoming requests
- Automatically constructs callback URLs based on the actual domain
- No code changes needed for new domains

### 2. Image Configuration

**File**: `next.config.mjs`

**No configuration needed!** Your images are served from the same origin via API routes (`/api/images/profiles`, `/api/images/groups`), so they work automatically with any domain.

```javascript
images: {
  unoptimized: true,
  // remotePatterns not needed - all images are same-origin
  // Auto-detects domain from request
}
```

**Note**: `remotePatterns` would only be needed if you loaded images from external domains (CDN, S3, etc.)

## OAuth Provider Configuration

For OAuth authentication (Google, Apple) to work with multiple domains, you **must** register callback URLs for each domain.

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: **APIs & Services** → **Credentials**
3. Select your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://callmiracle.com/api/auth/callback/google
   https://call.miracall.net/api/auth/callback/google
   ```
5. Click **Save**

### Apple Sign In Setup

1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. Navigate to: **Certificates, Identifiers & Profiles** → **Identifiers**
3. Select your App ID (Service ID): `net.miracall.signin`
4. Under **Return URLs**, add:
   ```
   https://callmiracle.com/api/auth/callback/apple
   https://call.miracall.net/api/auth/callback/apple
   ```
5. Click **Save**

## Infrastructure Requirements

### 1. DNS Configuration

Point both domains to your server:

```
callmiracle.com         → A Record → Your server IP
call.miracall.net       → A Record → Your server IP
```

Or use CNAME if pointing to another domain:

```
call.miracall.net       → CNAME → callmiracle.com
```

### 2. SSL Certificate

You need an SSL certificate that covers **both domains**. Options:

**Option A: Multi-Domain Certificate (SAN)**
```
Certificate covers:
- callmiracle.com
- www.callmiracle.com
- call.miracall.net
```

**Option B: Wildcard + Additional Domain**
```
Certificate 1: *.miracall.net (covers call.miracall.net)
Certificate 2: callmiracle.com
```

**Option C: Let's Encrypt (Recommended)**
```bash
# Using certbot
certbot certonly --nginx \
  -d callmiracle.com \
  -d www.callmiracle.com \
  -d call.miracall.net
```

### 3. Web Server Configuration

**Nginx Example**:

```nginx
server {
    listen 443 ssl http2;
    server_name callmiracle.com www.callmiracle.com call.miracall.net;

    ssl_certificate /etc/letsencrypt/live/callmiracle.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/callmiracle.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name callmiracle.com www.callmiracle.com call.miracall.net;
    return 301 https://$server_name$request_uri;
}
```

**Key Points**:
- `proxy_set_header Host $host;` - Passes the original domain to your app
- This enables NextAuth auto-detection

## Testing

### 1. Local Testing with Host File

To test multiple domains locally:

**Windows**: Edit `C:\Windows\System32\drivers\etc\hosts`
**macOS/Linux**: Edit `/etc/hosts`

Add:
```
127.0.0.1   callmiracle.local
127.0.0.1   call.miracall.local
```

Then update `.env.local`:
```env
# For local testing, uncomment and use HTTPS with local domains
# NEXTAUTH_URL=https://callmiracle.local:3003
```

### 2. Production Testing

After deployment, test both domains:

```bash
# Test callmiracle.com
curl -I https://callmiracle.com
curl -I https://callmiracle.com/api/auth/signin

# Test call.miracall.net
curl -I https://call.miracall.net
curl -I https://call.miracall.net/api/auth/signin
```

**Expected**: Both should return `200 OK` or appropriate redirects

### 3. OAuth Callback Testing

1. Visit `https://callmiracle.com` and sign in with Google
2. Visit `https://call.miracall.net` and sign in with Google
3. Both should work without errors

**Common Issues**:
- `redirect_uri_mismatch` → Check OAuth provider console has all callback URLs
- Cookie not being set → Ensure HTTPS is enabled (required for secure cookies)

## Adding Additional Domains

To add more domains in the future:

1. **Update OAuth providers**: Add callback URLs to Google/Apple consoles
2. **Update DNS**: Point new domain to your server
3. **Update SSL certificate**: Include new domain in certificate
4. **Update web server**: Add new domain to `server_name`

**That's it!** Everything else auto-detects - NextAuth, images, API routes all work automatically.

## Troubleshooting

### Issue: "redirect_uri_mismatch" error

**Cause**: OAuth callback URL not registered

**Solution**:
1. Check the exact error message for the callback URL
2. Add that exact URL to your OAuth provider console
3. Format must match exactly: `https://domain.com/api/auth/callback/provider`

### Issue: Cookies not being set

**Cause**: Using HTTP instead of HTTPS

**Solution**:
- Your secure cookies require HTTPS (see `src/lib/auth.ts:318-327`)
- Enable HTTPS on your server
- Update OAuth callback URLs to use `https://`

### Issue: Images not loading on new domain

**This should not happen** - images are same-origin and auto-detect the domain.

**If it does occur**:
1. Check that your web server passes the `Host` header correctly
2. Verify `/api/images/profiles/:id` route works on the new domain
3. Check browser console for actual error messages

### Issue: Session not persisting across domains

**Note**: Sessions are **domain-specific** by design. Users need to sign in separately for each domain. This is a security feature.

**Alternative**: If you want single sign-on across domains, you need to:
1. Use the same top-level domain (e.g., `app.example.com` and `api.example.com`)
2. Set cookie domain to `.example.com`
3. This is NOT recommended for different domains like `callmiracle.com` and `miracall.net`

## Security Considerations

### Secure Cookies

Your current configuration uses secure cookies with:
- `httpOnly: true` - Prevents JavaScript access
- `sameSite: 'none'` - Allows cross-site usage
- `secure: true` - Requires HTTPS
- `__Secure-` prefix - Browser enforces HTTPS

**This is correct and secure!** Just ensure HTTPS is always enabled.

### CORS

Currently, your app doesn't have explicit CORS restrictions. If needed, you can add:

```typescript
// In your API routes or middleware
headers: {
  'Access-Control-Allow-Origin': 'https://callmiracle.com, https://call.miracall.net',
  'Access-Control-Allow-Credentials': 'true'
}
```

However, this is typically **not needed** since all requests are same-origin (from the domain they're served on).

## Summary

✅ **Configured for auto-detection** - No hardcoded URLs
✅ **Multi-domain image support** - Added both production domains
✅ **OAuth ready** - Just need to register callback URLs
✅ **Secure cookies** - HTTPS required, properly configured

**Next Steps**:
1. Register OAuth callback URLs in Google/Apple consoles
2. Configure DNS for both domains
3. Obtain SSL certificate covering both domains
4. Configure your web server (Nginx/Apache/etc.)
5. Deploy and test!
