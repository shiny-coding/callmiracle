# 🚀 CallMiracle Production Deployment

Simple guide for deploying CallMiracle with Docker.

## 📋 Prerequisites

- Docker & Docker Compose installed
- MongoDB running on host machine (port 27017)
- Domain name configured (for NEXTAUTH_URL)

## 🛠️ Deployment Steps

### 1. Clone and Setup
```bash
# Clone repository
git clone https://github.com/your-username/callmiracle.git
cd callmiracle

# Create environment file
cp .env.example .env.local
```

### 2. Configure Environment
```bash
# Edit .env.local with your production values
nano .env.local

# Generate secure secret
openssl rand -base64 32
```

### 3. Deploy Application
```bash
# Build and start application
docker compose up -d --build

# Check status
docker compose ps
docker compose logs -f app
```

## 📊 Environment Variables

All environment variables are loaded from `.env.local` file automatically.

Key variables to configure:
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` - Your domain (https://yourdomain.com)
- `MONGODB_URI` - MongoDB connection string
- Email settings for notifications
- Firebase credentials for push notifications

## 🔄 Updates

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose down
docker compose up -d --build
```

## 📍 File Structure

```
/var/www/miracall.net/callmiracle/
├── docker-compose.yml     # Single production config
├── .env.local            # Your environment variables (not in git)
├── .env.example          # Template for environment variables
└── ...                   # Application files
```

## 🏃‍♂️ Systemd Service (Optional)

For automatic startup, your `callmiracle.service` is configured to:
- Start on boot
- Auto-restart on failure
- Use `/var/www/miracall.net/callmiracle` as working directory

```bash
sudo systemctl enable callmiracle
sudo systemctl start callmiracle
``` 