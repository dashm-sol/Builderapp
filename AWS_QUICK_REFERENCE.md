# AWS EC2 Deployment - Quick Reference

## ⚡ Quick Start (5 minutes)

### 1. Connect to EC2 Instance
```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

### 2. Run Auto Deployment Script
```bash
cd /tmp
curl -O https://raw.githubusercontent.com/YOUR_USER/builderapp/main/deploy-aws.sh
bash deploy-aws.sh
```

### 3. Configure API Credentials
```bash
nano /home/ubuntu/builderapp/.env
# Edit and add your Kite API credentials
# Save: Ctrl+O → Enter → Ctrl+X
```

### 4. Restart Backend
```bash
pm2 restart builderapp-backend
```

### 5. Access Application
```
http://YOUR_ELASTIC_IP
```

---

## 📊 Essential Commands

### View Logs
```bash
# Backend logs
pm2 logs builderapp-backend

# Last 50 lines
pm2 logs builderapp-backend --lines 50

# Real-time tail
pm2 logs builderapp-backend -f
```

### Manage Processes
```bash
# List all processes
pm2 status

# Restart backend
pm2 restart builderapp-backend

# Stop backend
pm2 stop builderapp-backend

# Start backend
pm2 start builderapp-backend

# Delete process
pm2 delete builderapp-backend
```

### Update Code
```bash
cd /home/ubuntu/builderapp
git pull origin main
npm run build
pm2 restart builderapp-backend
```

### Check Service Status
```bash
# Nginx status
sudo systemctl status nginx

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Port 4000 in use?
sudo lsof -i :4000
```

---

## 🔧 Configuration Files

### Backend Environment
```bash
nano /home/ubuntu/builderapp/.env
```

### Nginx Config
```bash
sudo nano /etc/nginx/sites-available/builderapp
# After changes:
sudo nginx -t
sudo systemctl restart nginx
```

### PM2 Startup
```bash
pm2 startup
pm2 save
```

---

## 🚨 Troubleshooting

### Application won't start
```bash
pm2 logs builderapp-backend
# Check .env file has all required variables
nano /home/ubuntu/builderapp/.env
```

### Can't access from browser
```bash
# 1. Check if backend is running
pm2 status

# 2. Check security group allows port 80
# AWS Console → Security Groups → Check inbound rules

# 3. Test local access
curl http://localhost

# 4. Check Nginx is running
sudo systemctl status nginx
```

### Port 4000 already in use
```bash
sudo lsof -i :4000
sudo kill -9 <PID>
pm2 start server/index.js --name "builderapp-backend"
```

### WebSocket connection failing
```bash
# Check backend is reachable
curl http://YOUR_ELASTIC_IP:4000/health

# Check Nginx WebSocket proxy config
sudo nano /etc/nginx/sites-available/builderapp
# Ensure location /ws block exists
```

### Out of disk space
```bash
df -h
# Clean npm cache
npm cache clean --force

# Clean old PM2 logs
pm2 flush
```

---

## 🔐 Security Checklist

- [ ] Updated .env with real Kite API credentials
- [ ] Set `ENABLE_LIVE_TRADING=false` for testing
- [ ] Restricted SSH to your IP in Security Group
- [ ] Tested automatic trading in sandbox mode
- [ ] Enabled MFA on AWS account
- [ ] Backed up EC2 instance
- [ ] Set up CloudWatch alerts
- [ ] Configured HTTPS/SSL (optional)

---

## 💰 Cost Monitor

```bash
# Check data transfer (approximate)
# AWS Console → CloudWatch → Billing

# Expected costs (US Region):
# - t2.small: $20-30/month
# - Elastic IP: Free (if in use)
# - Data: ~$0.09/GB outbound
```

---

## 🔄 Backup & Recovery

### Create Backup
```bash
# AWS Console → EC2 → Instances
# Right-click → Image and templates → Create image
# Name it: builderapp-backup-YYYY-MM-DD
```

### Restore from Backup
```bash
# AWS Console → AMIs → Find your backup
# Launch → Choose instance type → Continue
# Run deploy-aws.sh to restore app
```

### Database Backup (if added)
```bash
# Add this to crontab for daily backups
0 2 * * * /home/ubuntu/builderapp/backup.sh
```

---

## 📞 Support Resources

- **AWS EC2 Docs**: https://docs.aws.amazon.com/ec2/
- **PM2 Docs**: https://pm2.keymetrics.io/
- **Nginx Docs**: https://nginx.org/
- **Node.js Docs**: https://nodejs.org/

---

## 🚀 Performance Tips

1. **Monitor CPU & Memory**
   ```bash
   top
   free -h
   ```

2. **Enable Gzip Compression in Nginx**
   ```
   gzip on;
   gzip_types text/plain text/css application/json;
   ```

3. **Increase PM2 Memory Limit**
   ```bash
   pm2 start server/index.js --max-memory-restart 500M
   ```

4. **Setup CloudWatch Alerts**
   - CPU > 80%
   - Memory > 75%
   - Disk > 80%

---

## Example Workflow

### Day 1: Initial Setup
```bash
# Connect
ssh -i key.pem ubuntu@ELASTIC_IP

# Deploy
bash deploy-aws.sh

# Configure
nano .env  # Add credentials, ENABLE_LIVE_TRADING=false

# Test
curl http://localhost
```

### Day 2: Testing
```bash
# Check logs
pm2 logs builderapp-backend

# Test signals in browser
# http://ELASTIC_IP

# Verify automatic trading works (in test mode)
```

### Day 3+: Production
```bash
# Edit .env
nano .env  # Set ENABLE_LIVE_TRADING=true

# Restart
pm2 restart builderapp-backend

# Monitor
pm2 logs builderapp-backend -f

# Keep updated
cd /home/ubuntu/builderapp
git pull && npm run build && pm2 restart builderapp-backend
```

---

## Static IP Confirmation

✅ **Your static IP is ready!**
- Elastic IP assigned: `YOUR_ELASTIC_IP`
- Access point: `http://YOUR_ELASTIC_IP`
- Persistence: Remains same even after stop/start
- Cost: Free while instance is running

Perfect for 24/7 automatic trading! 🎯

