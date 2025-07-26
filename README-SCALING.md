# CallMiracle Horizontal Scaling Setup

This document explains how to deploy CallMiracle with multiple instances and load balancing.

## Architecture Overview

```
[Client] → [Nginx:3003] → [App1:3000, App2:3000, App3:3000] → [Redis] → [MongoDB]
```

- **Nginx**: Load balancer with server selection support
- **App Instances**: 3 configurable CallMiracle instances
- **Redis**: Shared PubSub for GraphQL subscriptions
- **MongoDB**: Shared database (external)

## Quick Start

### Option 1: Full Stack (Redis + Apps + Nginx)
1. **Start everything:**
   ```bash
   yarn scale:up
   ```

2. **Access the application:**
   - Main URL: http://localhost:3003
   - Health check: http://localhost:3003/health

3. **Stop deployment:**
   ```bash
   yarn scale:down
   ```

### Option 2: External Redis + Scaled Apps
Perfect for development where you want to run the app locally but use containers for scaling.

1. **Start Redis separately:**
   ```bash
   yarn redis:up
   ```

2. **Start scaled apps (without Redis):**
   ```bash
   yarn scale:external-redis
   ```

3. **Run local development:**
   ```bash
   yarn dev  # Connects to containerized Redis
   ```

4. **Access options:**
   - Scaled deployment: http://localhost:3003 (Nginx → 3 containers)
   - Local development: http://localhost:3003 (direct to your dev server)

5. **Stop services:**
   ```bash
   yarn scale:external-redis:down  # Stop app containers
   yarn redis:down                 # Stop Redis
   ```

### Option 3: Redis Only
If you just want Redis for local development:

```bash
yarn redis:up    # Start Redis
yarn redis:logs  # Monitor Redis
yarn redis:cli   # Access Redis CLI
yarn redis:down  # Stop Redis
```

## Monitoring

```bash
# All services
yarn scale:logs

# Individual services  
yarn scale:logs:app1
yarn scale:logs:app2
yarn scale:logs:app3
yarn scale:logs:nginx
yarn scale:logs:redis

# External Redis setup
yarn scale:external-redis:logs
yarn redis:logs
```

## Server Selection

### Automatic Load Balancing (Default)
- Round-robin distribution across all instances
- No session affinity
- Best for general use

### Manual Server Selection
Users can select a specific server in Profile Settings:

1. Go to Profile Settings
2. Find "Preferred Server" dropdown
3. Choose:
   - **Auto (Load Balanced)**: Default round-robin
   - **Server 1/2/3**: Connect to specific instance

### Server Selection Behavior
- **Cookie-based**: Preference stored in browser cookie
- **Immediate**: Takes effect on page reload
- **Persistent**: Preference saved for 30 days

## Configuration

### Environment Variables
Each app instance has these environment variables:

```env
# Instance identification
SERVER_ID=1|2|3

# Redis connection
REDIS_HOST=redis
REDIS_PORT=6379

# Shared database
MONGODB_URI=mongodb://host.docker.internal:27017/callmiracle
```

### Nginx Configuration
- **Load balancing**: Round-robin by default
- **Server selection**: Cookie-based routing
- **WebSocket support**: Enabled for GraphQL subscriptions
- **Health checks**: Available at `/health`

### Adding More Instances
To add more app instances:

1. **Update `docker-compose.scale.yml`:**
   ```yaml
   app4:
     build: .
     environment:
       - SERVER_ID=4
       # ... other config
   ```

2. **Update `nginx.conf`:**
   ```nginx
   upstream callmiracle_backend {
       server app1:3000;
       server app2:3000;
       server app3:3000;
       server app4:3000;  # Add new instance
   }
   
   upstream server4 {
       server app4:3000;
   }
   ```

3. **Update server context:**
   ```typescript
   // src/contexts/ServerContext.tsx
   const availableServers = ['auto', '1', '2', '3', '4']
   ```

## Troubleshooting

### Redis Connection Issues
```bash
# Check Redis logs
yarn scale:logs:redis

# Test Redis connectivity
docker exec -it callmiracle-redis-1 redis-cli ping
```

### Load Balancing Issues
```bash
# Check Nginx logs
yarn scale:logs:nginx

# Verify upstream servers
docker exec -it callmiracle-nginx-1 nginx -t
```

### WebRTC/Subscription Issues
- Ensure Redis is running and accessible
- Check that all app instances can connect to Redis
- Verify GraphQL subscriptions work across instances

### Health Monitoring
```bash
# Check all services status
docker-compose -f docker-compose.scale.yml ps

# Individual health checks
curl http://localhost:3003/health
curl http://localhost:3003/api/select-server
```

## Performance Considerations

### Resource Usage
- **3 App Instances**: ~1.5GB RAM total
- **Redis**: ~50MB RAM
- **Nginx**: ~10MB RAM

### Scaling Limits
- **Horizontal**: Can scale to 10+ instances
- **Database**: MongoDB connection pooling required
- **Redis**: Single instance sufficient for moderate load

### Monitoring
- Use observability stack: `yarn observability:up`
- Monitor Redis memory usage
- Track WebRTC connection success rates
- Monitor response times across instances

## Advanced Configuration

### Session Affinity
To enable sticky sessions instead of server selection:

```nginx
upstream callmiracle_backend {
    ip_hash;  # Enable session affinity
    server app1:3000;
    server app2:3000;
    server app3:3000;
}
```

### SSL/HTTPS
Add SSL certificates to nginx configuration:

```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
}
```

### Custom Redis Configuration
Mount custom Redis config:

```yaml
redis:
  image: redis:7-alpine
  volumes:
    - ./redis.conf:/usr/local/etc/redis/redis.conf
  command: redis-server /usr/local/etc/redis/redis.conf
```