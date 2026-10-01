#!/bin/bash

# BuilderApp AWS EC2 Deployment Script
# Run this script on your EC2 instance after SSH connection
# Usage: bash deploy-aws.sh

set -e  # Exit on error

echo "========================================="
echo "BuilderApp AWS EC2 Deployment"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    echo -e "${RED}❌ This script must be run as 'ubuntu' user${NC}"
    exit 1
fi

# Step 1: Update System
echo -e "${YELLOW}[1/8] Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Step 2: Install Node.js
echo -e "${YELLOW}[2/8] Installing Node.js 18 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
echo -e "${GREEN}✓ Node.js $(node --version) installed${NC}"

# Step 3: Install PM2 Globally
echo -e "${YELLOW}[3/8] Installing PM2 process manager...${NC}"
sudo npm install -g pm2
pm2 startup
echo -e "${GREEN}✓ PM2 installed${NC}"

# Step 4: Clone Repository
echo -e "${YELLOW}[4/8] Cloning repository...${NC}"
if [ ! -d "/home/ubuntu/builderapp" ]; then
    read -p "Enter GitHub repository URL: " REPO_URL
    cd /home/ubuntu
    git clone "$REPO_URL" builderapp
    echo -e "${GREEN}✓ Repository cloned${NC}"
else
    echo -e "${YELLOW}⚠ Repository already exists, skipping clone${NC}"
    cd /home/ubuntu/builderapp
    git pull origin main
fi

cd /home/ubuntu/builderapp

# Step 5: Install Dependencies
echo -e "${YELLOW}[5/8] Installing npm dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 6: Create .env File
echo -e "${YELLOW}[6/8] Creating .env configuration...${NC}"
if [ ! -f ".env" ]; then
    cat > .env << EOF
# Kite API Credentials
REACT_APP_KITE_API_KEY=your_api_key_here
REACT_APP_KITE_API_SECRET=your_api_secret_here
REACT_APP_KITE_ACCESS_TOKEN=your_access_token_here
REACT_APP_KITE_PUBLIC_TOKEN=your_public_token_here

# Server Configuration
SESSION_SECRET=$(openssl rand -base64 32)
BACKEND_PORT=4000
FRONTEND_URL=http://localhost:3000

# Enable Live Trading (⚠️ Use with caution!)
ENABLE_LIVE_TRADING=false

# Node Environment
NODE_ENV=production
EOF
    echo -e "${YELLOW}⚠ .env file created with default values${NC}"
    echo -e "${YELLOW}  → Edit .env and add your Kite API credentials${NC}"
    echo -e "${YELLOW}  → Command: nano /home/ubuntu/builderapp/.env${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Step 7: Build React App
echo -e "${YELLOW}[7/8] Building React production bundle...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"

# Step 8: Install & Configure Nginx
echo -e "${YELLOW}[8/8] Setting up Nginx reverse proxy...${NC}"
sudo apt install -y nginx

# Create Nginx config
sudo tee /etc/nginx/sites-available/builderapp > /dev/null << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    root /home/ubuntu/builderapp/build;
    index index.html index.htm index.nginx-debian.html;
    client_max_body_size 10M;

    # React Frontend - Single Page App
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support for live data
    location /ws {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable Nginx site
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/builderapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
echo -e "${GREEN}✓ Nginx configured and running${NC}"

# Start Backend with PM2
echo -e "${YELLOW}Starting backend server...${NC}"
pm2 start server/index.js --name "builderapp-backend" --env production
pm2 save

# Final Summary
echo ""
echo -e "${GREEN}========================================="
echo "✅ BuilderApp Deployment Complete!"
echo "=========================================${NC}"
echo ""
echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   • Frontend: http://YOUR_ELASTIC_IP (port 80)"
echo "   • Backend:  http://YOUR_ELASTIC_IP:4000"
echo ""
echo -e "${YELLOW}🔧 Configuration Steps:${NC}"
echo "   1. Get Kite API credentials from: https://kite.zerodha.com/api"
echo "   2. Edit .env file:"
echo "      nano /home/ubuntu/builderapp/.env"
echo "   3. Set ENABLE_LIVE_TRADING=true (only after testing!)"
echo "   4. Restart backend:"
echo "      pm2 restart builderapp-backend"
echo ""
echo -e "${YELLOW}📊 Useful Commands:${NC}"
echo "   • View backend logs:"
echo "     pm2 logs builderapp-backend"
echo ""
echo "   • Restart backend:"
echo "     pm2 restart builderapp-backend"
echo ""
echo "   • View all processes:"
echo "     pm2 status"
echo ""
echo "   • Update code:"
echo "     cd /home/ubuntu/builderapp && git pull && npm run build"
echo ""
echo -e "${YELLOW}🔐 Security Reminder:${NC}"
echo "   • Never commit .env to git"
echo "   • Keep your Kite API secret safe"
echo "   • Restrict SSH access to your IP in Security Group"
echo "   • Use HTTPS after domain setup"
echo ""
echo -e "${YELLOW}📚 Full Guide:${NC}"
echo "   See AWS_DEPLOYMENT_GUIDE.md in the repository"
echo ""

