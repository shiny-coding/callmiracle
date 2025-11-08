# SSH Tunnel Setup for dev.miracall.net

This guide explains how to access your local development server (localhost:3003) via a public domain (https://dev.miracall.net) using SSH reverse tunneling.

## Benefits

- ✅ Proper SSL certificate (Let's Encrypt)
- ✅ Consistent URL that doesn't change
- ✅ Test on any device (iPhone, Android, etc.)
- ✅ Share with others for testing
- ✅ No third-party services needed (like ngrok)

## Prerequisites

1. A server with SSH access and Apache installed (miracall.net)
2. Root/sudo access on the server
3. Ability to configure DNS for your domain

---

## Server Setup (One-time)

### 1. Configure Apache Virtual Host

SSH into your server:

```bash
ssh your-username@miracall.net
```

Create Apache virtual host:

```bash
sudo nano /etc/apache2/sites-available/dev.miracall.net.conf
```

Paste this configuration:

```apache
<VirtualHost *:80>
    ServerName dev.miracall.net

    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName dev.miracall.net

    SSLEngine on

    ProxyPreserveHost On
    ProxyRequests Off

    # Proxy to SSH tunnel port
    ProxyPass / http://127.0.0.1:3004/
    ProxyPassReverse / http://127.0.0.1:3004/

    # WebSocket support (for Next.js hot reload and GraphQL subscriptions)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://127.0.0.1:3004/$1 [P,L]
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /(.*)           http://127.0.0.1:3004/$1 [P,L]

    ErrorLog ${APACHE_LOG_DIR}/dev.miracall.net-error.log
    CustomLog ${APACHE_LOG_DIR}/dev.miracall.net-access.log combined
</VirtualHost>
```

### 2. Enable Required Apache Modules

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo a2enmod ssl
sudo a2ensite dev.miracall.net.conf
sudo systemctl reload apache2
```

### 3. Configure SSH Server for Remote Port Forwarding

Edit SSH config:

```bash
sudo nano /etc/ssh/sshd_config
```

Make sure these lines are present and uncommented:

```
GatewayPorts no
AllowTcpForwarding yes
```

**Important:** Use `GatewayPorts no` for security - this ensures the forwarded port (3004) only listens on localhost, not publicly accessible.

Restart SSH:

```bash
sudo systemctl restart sshd
```

### 4. Get SSL Certificate

```bash
sudo certbot --apache -d dev.miracall.net
```

Follow the prompts. Choose option 2 to redirect HTTP to HTTPS.

### 5. Configure DNS

In your domain registrar's DNS settings, add:

```
Type: A
Name: dev
Value: [Your server's IP address]
TTL: 300
```

Wait 5-10 minutes for DNS propagation.

---

## Local Machine Setup

### 1. Edit Tunnel Scripts

Edit both tunnel scripts and replace the placeholder values:

```bash
nano scripts/ssh-tunnel.sh
nano scripts/ssh-tunnel-persistent.sh
```

Update these lines:
```bash
REMOTE_USER="your-username"  # Your SSH username
REMOTE_HOST="miracall.net"   # Your server hostname or IP
```

### 2. Set Up SSH Key Authentication (Recommended)

If you don't have SSH keys set up:

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy to server
ssh-copy-id your-username@miracall.net
```

Test passwordless login:
```bash
ssh your-username@miracall.net
```

If it logs in without asking for a password, you're good!

---

## Usage

### Start Your Development Server

```bash
yarn dev
# or
yarn dev-ssl
```

Make sure it's running on port 3003.

### Start the SSH Tunnel

**Option 1: Basic tunnel**

```bash
yarn tunnel
```

**Option 2: Persistent tunnel (auto-reconnects)**

```bash
yarn tunnel:persistent
```

This requires `autossh` (will auto-install on first run).

### Access Your Dev Server

Open in any browser or device:

```
https://dev.miracall.net
```

That's it! Your local dev server is now publicly accessible.

---

## Workflow

Typical development session:

```bash
# Terminal 1: Start dev server
yarn dev

# Terminal 2: Start tunnel
yarn tunnel:persistent
```

Now you can test on your iPhone, share with team members, etc.

---

## Troubleshooting

### Tunnel won't connect

**Check if SSH works:**
```bash
ssh your-username@miracall.net
```

**Check if port 3003 is running locally:**
```bash
nc -z localhost 3003
```

**Check server logs:**
```bash
ssh your-username@miracall.net
sudo tail -f /var/log/apache2/dev.miracall.net-error.log
```

### "Connection refused" or 502 Bad Gateway

This usually means:
1. Your local dev server isn't running
2. The tunnel isn't active

Make sure both are running.

### Tunnel keeps disconnecting

Use the persistent version:
```bash
yarn tunnel:persistent
```

### WebSocket connections failing

Make sure Apache modules are enabled:
```bash
sudo a2enmod proxy_wstunnel
sudo systemctl reload apache2
```

Check Apache logs for websocket errors:
```bash
sudo tail -f /var/log/apache2/dev.miracall.net-error.log
```

---

## Security Notes

1. **GatewayPorts no**: The tunneled port (3004) only listens on localhost on the server - not publicly accessible
2. **Apache as gateway**: All requests go through Apache with SSL
3. **Firewall**: Only port 22 (SSH), 80, and 443 need to be open
4. **Development only**: This is for development. Don't use for production!

---

## Stopping the Tunnel

Press `Ctrl+C` in the tunnel terminal.

Or kill all tunnel processes:

```bash
pkill -f "ssh.*3004:localhost:3003"
```

---

## Alternative: Background Tunnel

To run the tunnel in the background:

```bash
nohup yarn tunnel:persistent > tunnel.log 2>&1 &
```

View logs:
```bash
tail -f tunnel.log
```

Kill background tunnel:
```bash
pkill -f "autossh.*3004"
```
