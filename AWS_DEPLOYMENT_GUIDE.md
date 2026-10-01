# AWS EC2 Deployment Guide for BuilderApp

This guide walks through deploying BuilderApp to AWS EC2 with a static IP for automatic trading.

---

## Step 1: Create AWS EC2 Instance

### 1.1 Launch Instance
1. Go to **AWS Console** → **EC2** → **Instances** → **Launch Instances**
2. **Choose AMI**: Select **Ubuntu Server 22.04 LTS** (free tier eligible)
3. **Instance Type**: `t2.medium` or `t3.small` (recommended for trading bot)
   - Free tier: `t2.micro` (1 GB RAM - minimal)
   - Better: `t2.small` or `t3.small` (2 GB RAM - recommended)
4. **Network Settings**:
   - Create or select a **VPC**
   - Enable **Auto-assign public IP**
5. **Storage**: 20 GB (default is fine)
6. **Security Group** (create new):
   - ✅ SSH (port 22): **FROM YOUR IP ONLY** (e.g., 203.45.67.89/32)
   - ✅ HTTP (port 80): from anywhere (0.0.0.0/0)
   - ✅ HTTPS (port 443): from anywhere (0.0.0.0/0)
   - ✅ Custom TCP (port 4000): from anywhere (0.0.0.0/0)
   
   **⚠️ SECURITY WARNING:**
   - **DO NOT** use 0.0.0.0/0 for SSH port 22!
   - This exposes your server to brute force attacks
   - Always restrict SSH to your IP address only

### 1.2 Key Pair
- Create a new key pair or use existing
- Download `.pem` file and keep it safe
- Permissions: `chmod 400 your-key.pem`

### 1.3 Security Group Configuration (CRITICAL!)

**⚠️ SECURITY FIRST:**

1. **Find your IP address:**
   - Visit: https://www.whatismyipaddress.com/
   - Note down your IP (e.g., 203.45.67.89)

2. **Configure Security Group Rules:**

   **⚠️ IMPORTANT: Handle Dynamic IP Changes**
   
   You have TWO options:
   
   **OPTION A: Use AWS Session Manager (RECOMMENDED - No SSH needed)**
   - No port 22 open at all (more secure)
   - Works with dynamic IPs (no IP restriction needed)
   - Access from AWS Console without SSH keys
   - See: "Alternative: AWS Session Manager" section below
   
   **OPTION B: Use SSH with ISP IP Range (If you prefer SSH)**
   - Use your ISP's IP RANGE instead of single IP
   - Survives dynamic IP changes
   - Still requires .pem key
   
   **OPTION B-1: Single IP (Only if IP is static):**
   ```
   Type: SSH
   Protocol: TCP
   Port Range: 22
   Source: YOUR_IP/32
   Example: 203.45.67.89/32
   ⚠️ WARNING: Won't work after ISP changes your IP!
   ```
   
   **OPTION B-2: ISP IP Range (Recommended for SSH users):**
   ```
   Type: SSH
   Protocol: TCP
   Port Range: 22
   Source: YOUR_ISP_RANGE/16
   Example: 203.45.0.0/16
   ✅ Works even if ISP changes your IP
   ✅ Covers all your ISP's IPs
   ```
   
   To find your ISP range:
   ```
   1. Visit: https://www.whatismyipaddress.com/
   2. See your IP (e.g., 203.45.67.89)
   3. Use first two octets + /16 (e.g., 203.45.0.0/16)
   
   **HTTP (Port 80) - ALLOW PUBLIC:**
   ```
   Type: HTTP
   Protocol: TCP
   Port Range: 80
   Source: 0.0.0.0/0 (Allow from anywhere)
   ```
   
   **HTTPS (Port 443) - ALLOW PUBLIC:**
   ```
   Type: HTTPS
   Protocol: TCP
   Port Range: 443
   Source: 0.0.0.0/0 (Allow from anywhere)
   ```
   
   **Custom TCP (Port 4000) - BACKEND API:**
   ```
   Type: Custom TCP
   Protocol: TCP
   Port Range: 4000
   Source: 0.0.0.0/0 (Allow from anywhere)
   ```

3. **Why restrict SSH?**
   - Port 22 is constantly scanned by hackers worldwide
   - Restricting to your IP prevents brute force attacks
   - Your .pem key is still required even if IP matches
   - This is security best practice

4. **If your ISP changes your IP:**
   - You won't be able to SSH into the server
   - Update the security group rule with your new IP
   - Or find your ISP's IP range and use that (e.g., 203.45.0.0/16)

---

## Step 2: Allocate Static IP (Elastic IP)

1. Go to **EC2 Dashboard** → **Elastic IPs** → **Allocate Elastic IP Address**
2. **Domain**: Select your region
3. **Allocate**
4. Right-click the new Elastic IP → **Associate Elastic IP address**
5. Select your instance and network interface
6. **Associate**

✅ Now you have a **permanent static IP** for automatic trading!

---

## Step 3: Connect to EC2 Instance

### Option A: SSH Connection (If using ISP IP range)

```bash
# On your local machine
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

Replace `YOUR_ELASTIC_IP` with your Elastic IP address (e.g., 54.123.45.67)

### Option B: AWS Session Manager (Recommended for Dynamic IPs)

**Better solution if your ISP gives you dynamic IPs!**

#### Setup (One-time):

**Step 1: Create IAM Role**
```bash
# AWS Console → IAM → Roles → Create Role
# Select: AWS service → EC2
# Attach policy: AmazonSSMManagedInstanceCore
# Name: EC2-SessionManager-Role
```

**Step 2: Attach to Instance**
```
EC2 Console → Your Instance
Right-click → Security → Modify IAM role
Select: EC2-SessionManager-Role
```

**Step 3: Update Security Group**
- Remove SSH (port 22) rule completely
- Keep: HTTP (80), HTTPS (443), Custom TCP (4000)

#### Connect to Server:

```bash
# List your instances
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running"

# Connect (replace with your instance ID)
aws ssm start-session --target i-0a1b2c3d4e5f6g7h8

# Get ubuntu shell
sudo su - ubuntu
cd /home/ubuntu/builderapp
```

#### Advantages:
✅ No SSH keys needed  
✅ Works with dynamic IPs  
✅ No port 22 open (more secure)  
✅ IAM-based authentication  
✅ Fully encrypted by AWS  

---

---

## Step 4: Install Dependencies

### 4.1 Update System
```bash
sudo apt update
sudo apt upgrade -y
```

### 4.2 Install Node.js (v18 LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

### 4.3 Install Git
```bash
sudo apt install -y git
```

### 4.4 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

## Step 5: Clone & Setup Application

### 5.1 Clone Repository
```bash
cd /home/ubuntu
git clone <your-repo-url> builderapp
cd builderapp
```

If using private repo:
```bash
# Generate GitHub Personal Access Token first
git clone https://oauth2:YOUR_TOKEN@github.com/YOUR_USER/builderapp.git
```

### 5.2 Install Dependencies
```bash
npm install
```

### 5.3 Create Environment File
```bash
nano .env
```

Add your configuration:
```env
# Kite API Credentials
REACT_APP_KITE_API_KEY=your_api_key_here
REACT_APP_KITE_API_SECRET=your_api_secret_here
REACT_APP_KITE_ACCESS_TOKEN=your_access_token_here
REACT_APP_KITE_PUBLIC_TOKEN=your_public_token_here

# Server Configuration
SESSION_SECRET=your_secure_random_secret_here
BACKEND_PORT=4000
FRONTEND_URL=http://YOUR_ELASTIC_IP:3000

# Enable Live Trading (⚠️ Use with caution!)
ENABLE_LIVE_TRADING=true

# Node Environment
NODE_ENV=production
```

**⚠️ SECURITY**: Avoid committing `.env` to git!

### 5.4 Build React App
```bash
npm run build
```

This creates optimized production build in `/build` folder.

---

## Step 6: Run Application with PM2

### 6.1 Start Backend Server
```bash
# Navigate to server directory
cd /home/ubuntu/builderapp

# Start backend with PM2
pm2 start server/index.js --name "builderapp-backend" --env production
```

### 6.2 Serve Frontend (Option A: Using Node Server)
```bash
# Install serve globally
sudo npm install -g serve

# Start frontend
pm2 start "serve -s build -l 3000" --name "builderapp-frontend"
```

### 6.3 Serve Frontend (Option B: Using Nginx - Recommended)
```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/builderapp
```

Add this configuration:
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    root /home/ubuntu/builderapp/build;
    index index.html index.htm index.nginx-debian.html;

    # Frontend (React)
    location / {
        try_files $uri $uri/ /index.html;
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
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable & restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/builderapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Then start only the backend with PM2:
```bash
pm2 start server/index.js --name "builderapp-backend" --env production
```

### 6.4 Save PM2 Config
```bash
pm2 save
pm2 startup
```

This ensures apps restart on server reboot.

### 6.5 Check Status
```bash
pm2 status
pm2 logs builderapp-backend
pm2 logs builderapp-frontend  # if using serve
```

---

## Step 7: Access Your Application

Open browser and go to:
- **Frontend**: `http://YOUR_ELASTIC_IP:80` or `http://YOUR_ELASTIC_IP:3000`
- **Backend**: `http://YOUR_ELASTIC_IP:4000`

Example: `http://54.123.45.67`

---

## Step 8: Setup SSL/HTTPS (Optional but Recommended)

### 8.1 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 8.2 Get Free Certificate (Let's Encrypt)
```bash
sudo certbot certonly --standalone -d YOUR_DOMAIN
# If you have a domain, update DNS records to point to your Elastic IP first
```

### 8.3 Update Nginx Config
```bash
sudo nano /etc/nginx/sites-available/builderapp
```

Add SSL configuration:
```nginx
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    
    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;
    
    server_name _;
    
    # ... rest of config ...
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

Restart Nginx:
```bash
sudo systemctl restart nginx
```

---

## Step 9: Monitor Logs

### Backend Logs
```bash
pm2 logs builderapp-backend
```

### Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### System Logs
```bash
sudo journalctl -u nginx -f
```

---

## Step 10: Backup & Updates

### 10.1 Regular Backups
```bash
# Create snapshot of EC2 instance
# AWS Console → Instances → Right-click → Image and templates → Create image
```

### 10.2 Deploy Updates
```bash
cd /home/ubuntu/builderapp
git pull origin main
npm install
npm run build

# Restart backend
pm2 restart builderapp-backend
# Restart nginx if using it
sudo systemctl restart nginx
```

---

## Troubleshooting

### App won't start?
```bash
pm2 logs builderapp-backend --lines 50
```

### Port already in use?
```bash
sudo lsof -i :4000
sudo kill -9 <PID>
```

### Check instance security groups
```bash
# AWS Console → EC2 → Security Groups
# Ensure ports 80, 443, 4000, 22 are open
```

### Can't access frontend?
```bash
curl http://localhost:3000  # From EC2
# If works locally but not remotely, check Security Group rules
```

### Backend API calls failing?
```bash
# Ensure .env has correct FRONTEND_URL
# Check backend logs: pm2 logs builderapp-backend
```

---

## Cost Estimation (US Region)

| Resource | Type | Cost/Month |
|----------|------|-----------|
| EC2 Instance | t2.small (1yr) | ~$20-30 |
| Elastic IP | Static IP | Free (if in use) |
| Data Transfer | Outbound | ~$0.09/GB |
| **Total** | | **~$25-35** |

✅ **Much cheaper than always-on desktop or VPS for trading!**

---

## Security Best Practices

1. ✅ Keep .env file safe (never commit to git)
2. ✅ Restrict SSH to your ISP IP range (or use Session Manager)
3. ✅ Use strong passwords for Kite API
4. ✅ Enable MFA on AWS account
5. ✅ Regularly update system: `sudo apt update && sudo apt upgrade`
6. ✅ Monitor EC2 CloudWatch for unusual activity
7. ✅ Use IAM roles instead of access keys when possible
8. ✅ Enable automatic backups via AWS Backup
9. ✅ For dynamic IPs: Use Session Manager instead of SSH

---

## Dynamic IP Solutions

### Problem: ISP gives you dynamic IP that changes
```
Today:  Your IP = 203.45.67.89 → Can access server ✅
Later:  ISP changes to 203.45.68.45 → Locked out ❌
```

### Solution 1: AWS Session Manager (BEST)
```
✅ Works with any IP (no IP restriction needed)
✅ More secure (no port 22 open)
✅ No SSH keys required
✅ Free!
→ Use this! See "Option B" in Step 3
```

### Solution 2: Use ISP IP Range
```
Instead of: 203.45.67.89/32 (single IP)
Use: 203.45.0.0/16 (your ISP's range)
→ Survives IP changes
→ Still requires SSH key
```

### Solution 3: VPN with Static IP
```
Get VPN with static IP (~$5-10/month)
Then use: VPN_IP/32 in security group
→ Works reliably
→ Adds encryption
```

---

## Monitoring Automatic Trading

Once deployed, you can:

1. **Access from anywhere**: `http://YOUR_ELASTIC_IP`
2. **Enable automatic trading** without keeping laptop on
3. **Monitor live signals** in real-time
4. **Set alerts** for trade execution
5. **View logs remotely**: `ssh ubuntu@YOUR_ELASTIC_IP` then `pm2 logs`

---

## Support & Next Steps

For issues:
1. Check logs: `pm2 logs builderapp-backend`
2. Verify .env configuration
3. Check Security Group rules allow traffic
4. Ensure Elastic IP is associated with instance

Happy trading! 🚀

