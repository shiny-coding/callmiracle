#!/bin/bash

# SSH Reverse Tunnel Script for dev.miracall.net
# This creates a tunnel from your remote server to your local dev server

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
REMOTE_USER="your-username"  # Replace with your SSH username
REMOTE_HOST="miracall.net"   # Your server hostname or IP
REMOTE_PORT=3004             # Port on remote server (Apache proxies to this)
LOCAL_PORT=3003              # Your local dev server port

echo -e "${GREEN}Setting up SSH tunnel for dev.miracall.net${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Remote: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
echo "  Local:  localhost:${LOCAL_PORT}"
echo ""

# Check if local dev server is running
if ! nc -z localhost ${LOCAL_PORT} 2>/dev/null; then
    echo -e "${RED}Warning: No service detected on localhost:${LOCAL_PORT}${NC}"
    echo "Make sure your dev server is running (yarn dev)"
    echo ""
fi

# Check if tunnel already exists
if pgrep -f "ssh.*${REMOTE_PORT}:localhost:${LOCAL_PORT}" > /dev/null; then
    echo -e "${YELLOW}Existing tunnel found. Killing it...${NC}"
    pkill -f "ssh.*${REMOTE_PORT}:localhost:${LOCAL_PORT}"
    sleep 2
fi

echo -e "${GREEN}Starting SSH reverse tunnel...${NC}"
echo ""
echo -e "${YELLOW}Access your dev server at: https://dev.miracall.net${NC}"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Start SSH reverse tunnel
# -N: Don't execute remote command
# -R: Reverse tunnel (remote port forwards to local)
# -o ServerAliveInterval=60: Keep connection alive
# -o ExitOnForwardFailure=yes: Exit if port forwarding fails
ssh -N -R ${REMOTE_PORT}:localhost:${LOCAL_PORT} \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    ${REMOTE_USER}@${REMOTE_HOST}
