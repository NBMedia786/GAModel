# Frame AI Hub - Production Deployment Guide

## Prerequisites

### Required Software
- **Node.js**: v18 or higher
- **FFmpeg**: Required for video processing
- **npm**: v9 or higher

### Required Accounts
- **Google Cloud Account**: For Gemini API access

---

## Environment Setup

### 1. Clone and Install Dependencies

```bash
cd frame-ai-hub-main
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and configure the following:

```env
# REQUIRED: Your Google Gemini API Key
GEMINI_API_KEY=your_actual_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=production

# Storage
HISTORY_DIR=history

# CORS - Set to your frontend domain(s)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MINUTES=15
```

**⚠️ CRITICAL**: Never commit `.env` to version control!

### 3. Install FFmpeg

#### Windows:
```powershell
# Using Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install ffmpeg
```

#### macOS:
```bash
brew install ffmpeg
```

Verify installation:
```bash
ffmpeg -version
```

---

## Building the Application

### Build Frontend
```bash
npm run build
```

This creates optimized production files in the `dist/` directory.

---

## Running in Production

### Option 1: Using PM2 (Recommended)

PM2 is a production process manager for Node.js applications.

#### Install PM2
```bash
npm install -g pm2
```

#### Start the Application
```bash
pm2 start server.js --name frame-ai-hub
```

#### Useful PM2 Commands
```bash
# View logs
pm2 logs frame-ai-hub

# Monitor
pm2 monit

# Restart
pm2 restart frame-ai-hub

# Stop
pm2 stop frame-ai-hub

# Auto-start on system reboot
pm2 startup
pm2 save
```

### Option 2: Using Node Directly
```bash
NODE_ENV=production node server.js
```

---

## Security Checklist

Before deploying to production, verify:

- [ ] ✅ `.env` file is NOT committed to git
- [ ] ✅ `GEMINI_API_KEY` is set and valid
- [ ] ✅ `NODE_ENV=production` is set
- [ ] ✅ `CORS_ORIGINS` is configured for your domain (not `*`)
- [ ] ✅ FFmpeg is installed and accessible
- [ ] ✅ Rate limiting is configured appropriately
- [ ] ✅ HTTPS is configured (see Reverse Proxy section)
- [ ] ✅ Firewall rules are configured
- [ ] ✅ Log files are being rotated
- [ ] ✅ Backup strategy is in place

---

## Reverse Proxy Setup (HTTPS)

### Using Nginx

#### Install Nginx
```bash
# Ubuntu/Debian
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

#### Configure Nginx

Create `/etc/nginx/sites-available/frame-ai-hub`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Node.js app
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
        
        # Increase timeouts for video uploads
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        client_max_body_size 2G;
    }
}
```

#### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/frame-ai-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Setup SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Monitoring and Logging

### Log Files

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

### Log Rotation

Create `/etc/logrotate.d/frame-ai-hub`:

```
/path/to/frame-ai-hub-main/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Monitoring with PM2

```bash
# Real-time monitoring
pm2 monit

# Web-based monitoring (optional)
pm2 install pm2-server-monit
```

---

## Backup Strategy

### What to Backup

1. **Project Data**: `history/` directory
2. **Configuration**: `.env` file (store securely!)
3. **Logs**: `logs/` directory (optional)

### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/frame-ai-hub"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/path/to/frame-ai-hub-main"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup history directory
tar -czf $BACKUP_DIR/history_$DATE.tar.gz -C $APP_DIR history/

# Backup .env (encrypted)
gpg --encrypt --recipient your@email.com -o $BACKUP_DIR/env_$DATE.gpg $APP_DIR/.env

# Keep only last 30 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.gpg" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Schedule with cron:
```bash
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

---

## Performance Optimization

### 1. Enable Compression

Already handled by Helmet middleware, but ensure Nginx compression is enabled:

```nginx
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### 2. Adjust Rate Limits

For high-traffic sites, adjust in `.env`:

```env
RATE_LIMIT_MAX=500
RATE_LIMIT_WINDOW_MINUTES=15
```

### 3. Increase Node.js Memory (if needed)

```bash
pm2 start server.js --name frame-ai-hub --node-args="--max-old-space-size=4096"
```

---

## Troubleshooting

### Server Won't Start

1. Check logs: `pm2 logs frame-ai-hub`
2. Verify `.env` file exists and has correct values
3. Ensure port 3000 is not in use: `lsof -i :3000`
4. Check FFmpeg: `ffmpeg -version`

### Video Upload Fails

1. Check file size limit (2GB max)
2. Verify FFmpeg is installed
3. Check disk space: `df -h`
4. Review logs in `logs/error.log`

### High Memory Usage

1. Monitor with: `pm2 monit`
2. Check for stuck analysis jobs
3. Restart: `pm2 restart frame-ai-hub`

### Rate Limit Issues

1. Adjust limits in `.env`
2. Check client IP: `pm2 logs | grep "Rate limit"`
3. Consider implementing authentication

---

## Health Checks

### Manual Health Check
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "uptime": 12345,
  "environment": "production",
  "ffmpeg": "available",
  "historyDir": "accessible",
  "geminiApiKey": "configured"
}
```

### Automated Monitoring

Use services like:
- **UptimeRobot**: Free uptime monitoring
- **Pingdom**: Advanced monitoring
- **New Relic**: Application performance monitoring

---

## Scaling Considerations

### Current Limitations

- Single server deployment
- File-based storage (not suitable for multi-server)
- 1 concurrent analysis job

### Future Improvements

1. **Database**: Migrate from file storage to PostgreSQL/MongoDB
2. **Object Storage**: Use S3 for video files
3. **Redis**: For session management and caching
4. **Load Balancer**: For horizontal scaling
5. **Queue System**: Bull/BullMQ for job processing

---

## Security Best Practices

### 1. Keep Dependencies Updated
```bash
npm audit
npm audit fix
```

### 2. Regular Security Scans
```bash
npm install -g snyk
snyk test
```

### 3. Firewall Configuration

```bash
# Ubuntu UFW
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

### 4. Fail2Ban (Prevent Brute Force)

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

---

## Support and Maintenance

### Regular Maintenance Tasks

- **Daily**: Check logs for errors
- **Weekly**: Review disk space usage
- **Monthly**: Update dependencies
- **Quarterly**: Security audit

### Getting Help

- Check logs: `logs/error.log`
- Review health endpoint: `/api/health`
- Monitor PM2: `pm2 monit`

---

## Quick Reference

### Common Commands

```bash
# Start
pm2 start server.js --name frame-ai-hub

# Stop
pm2 stop frame-ai-hub

# Restart
pm2 restart frame-ai-hub

# Logs
pm2 logs frame-ai-hub

# Monitor
pm2 monit

# Health check
curl http://localhost:3000/api/health

# Backup
./backup.sh
```

---

**Last Updated**: 2025-11-27  
**Version**: 1.0
