#!/bin/bash

# Script to generate self-signed SSL certificate for local development
# Supports localhost, IP addresses, and custom domains

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}SSL Certificate Generator for Local Development${NC}"
echo ""

# Get the Windows host IP (from WSL)
WSL_HOST_IP=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')

# Try to detect the local network IP
NETWORK_IP=""
if command -v hostname &> /dev/null; then
    NETWORK_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "")
fi

# Ask user for additional IPs or domains
echo -e "${YELLOW}Current detected IPs:${NC}"
echo "  - WSL Host IP: $WSL_HOST_IP"
if [ -n "$NETWORK_IP" ]; then
    echo "  - Network IP: $NETWORK_IP"
fi
echo ""
echo -e "${YELLOW}Please enter your Windows machine's local network IP address:${NC}"
echo "  (Find it by running 'ipconfig' on Windows, look for IPv4 Address)"
echo "  (Example: 192.168.1.100 or 10.0.0.50)"
read -p "IP Address: " USER_IP

if [ -z "$USER_IP" ]; then
    echo -e "${RED}Error: IP address is required${NC}"
    exit 1
fi

# Create certs directory if it doesn't exist
mkdir -p certs

# Generate OpenSSL configuration file
cat > certs/openssl.cnf << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=Development
L=Development
O=Development
OU=Development
emailAddress=dev@localhost
CN=localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment, digitalSignature
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
IP.3 = $WSL_HOST_IP
IP.4 = $USER_IP
EOF

# Add network IP if available and different from user IP
if [ -n "$NETWORK_IP" ] && [ "$NETWORK_IP" != "$USER_IP" ]; then
    echo "IP.5 = $NETWORK_IP" >> certs/openssl.cnf
fi

echo ""
echo -e "${GREEN}Generating SSL certificate...${NC}"

# Generate private key
openssl genrsa -out certs/localhost-key.pem 2048

# Generate certificate
openssl req -new -x509 -key certs/localhost-key.pem \
    -out certs/localhost.pem \
    -days 825 \
    -config certs/openssl.cnf \
    -extensions v3_req

# Display certificate info
echo ""
echo -e "${GREEN}Certificate generated successfully!${NC}"
echo ""
echo -e "${YELLOW}Certificate details:${NC}"
openssl x509 -in certs/localhost.pem -text -noout | grep -A 10 "Subject Alternative Name"

echo ""
echo -e "${GREEN}✓ Certificate is now valid for:${NC}"
echo "  - https://localhost:3003"
echo "  - https://$WSL_HOST_IP:3003"
echo "  - https://$USER_IP:3003"
if [ -n "$NETWORK_IP" ] && [ "$NETWORK_IP" != "$USER_IP" ]; then
    echo "  - https://$NETWORK_IP:3003"
fi

echo ""
echo -e "${YELLOW}Note: This is a self-signed certificate.${NC}"
echo "You'll need to accept the security warning in your browser."
echo ""
echo -e "${YELLOW}On iOS/iPhone:${NC}"
echo "1. Navigate to https://$USER_IP:3003"
echo "2. Tap 'Show Details' or 'Advanced'"
echo "3. Tap 'Visit this website' or 'Proceed'"
echo "4. Confirm you want to visit the website"
echo ""
echo -e "${GREEN}Run 'yarn dev-ssl' to start the server with SSL${NC}"
