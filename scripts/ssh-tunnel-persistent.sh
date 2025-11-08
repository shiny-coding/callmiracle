#!/bin/bash

# Persistent SSH Reverse Tunnel with autossh
# Automatically reconnects if connection drops

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

echo -e "${GREEN}Setting up persistent SSH tunnel for dev.miracall.net${NC}"
echo ""

# Check if autossh is installed
if ! command -v autossh &> /dev/null; then
    echo -e "${YELLOW}autossh not found. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y autossh
fi

# Check if local dev server is running
if ! nc -z localhost ${LOCAL_PORT} 2>/dev/null; then
    echo -e "${RED}Warning: No service detected on localhost:${LOCAL_PORT}${NC}"
    echo "Make sure your dev server is running first!"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Kill existing autossh tunnels
if pgrep -f "autossh.*${REMOTE_PORT}" > /dev/null; then
    echo -e "${YELLOW}Killing existing tunnel...${NC}"
    pkill -f "autossh.*${REMOTE_PORT}"
    sleep 2
fi

echo -e "${GREEN}Starting persistent SSH tunnel...${NC}"
echo ""
echo -e "${YELLOW}Access your dev server at: https://dev.miracall.net${NC}"
echo ""
echo "The tunnel will automatically reconnect if the connection drops."
echo "Press Ctrl+C to stop"
echo ""

# Start autossh
# AUTOSSH_GATETIME=0: Consider connection successful immediately
# -M 0: Don't use monitoring port (rely on ServerAliveInterval instead)
# -N: Don't execute remote command
# -R: Reverse tunnel
export AUTOSSH_GATETIME=0
autossh -M 0 \
    -N \
    -R ${REMOTE_PORT}:localhost:${LOCAL_PORT} \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -o StrictHostKeyChecking=no \
    ${REMOTE_USER}@${REMOTE_HOST}
