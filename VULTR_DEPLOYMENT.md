# Vultr Deployment Guide

This guide covers deploying the SurveiLens web UI and CV Event API to Vultr.

## Architecture Overview

```
CV Detection Workers → CV Event API (Vultr) → Snowflake
                              ↓
                         Web UI (Vultr)
```

## Prerequisites

1. **Vultr Account**: Sign up at https://www.vultr.com
2. **Snowflake Account**: Configured with credentials
3. **Domain Name** (optional): For custom domain setup
4. **SSL Certificate**: Let's Encrypt (free) or custom

## Option 1: Vultr App Platform (Recommended)

Vultr App Platform provides easy deployment with automatic scaling and SSL.

### 1.1 Deploy CV Event API

1. **Create New App**:
   - Go to Vultr Dashboard → App Platform
   - Click "Create App"
   - Choose "Docker" or "Python"

2. **Configure App**:
   - **Name**: `surveilens-cv-api`
   - **Runtime**: Python 3.11
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python backend/cv_event_api.py`
   - **Port**: `8001`

3. **Environment Variables**:
   ```env
   CV_API_PORT=8001
   SNOW_ACCOUNT=your_account
   SNOW_USER=your_user
   SNOW_PASS=your_password
   SNOW_WH=COMPUTE_WH
   SNOW_DB=SURVEILENS
   SNOW_SCHEMA=CORE
   DEMO_MODE=false
   ```

4. **Deploy**:
   - Connect your GitHub repository
   - Select the branch to deploy
   - Click "Deploy"

### 1.2 Deploy Web UI

1. **Create New App**:
   - Go to Vultr Dashboard → App Platform
   - Click "Create App"
   - Choose "Static Site"

2. **Configure App**:
   - **Name**: `surveilens-web`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Node Version**: 18.x

3. **Environment Variables**:
   ```env
   VITE_AUTH0_DOMAIN=your_auth0_domain
   VITE_AUTH0_CLIENT_ID=your_client_id
   VITE_AUTH0_AUDIENCE=https://surveilens/api
   VITE_BACKEND_BASE_URL=https://your-cv-api-url.vultr.app
   ```

4. **Deploy**:
   - Connect your GitHub repository
   - Select the branch to deploy
   - Click "Deploy"

## Option 2: Vultr VPS (More Control)

### 2.1 Create VPS Instance

1. **Create Instance**:
   - Go to Vultr Dashboard → Products → Deploy Server
   - **Server Type**: Cloud Compute
   - **CPU & Storage**: Regular Performance (2 CPU, 4GB RAM minimum)
   - **Location**: Choose closest to your users
   - **OS**: Ubuntu 22.04 LTS
   - **Firewall**: Create firewall rules (allow ports 80, 443, 8001)

2. **Firewall Rules**:
   - Port 80 (HTTP) - Allow from Anywhere
   - Port 443 (HTTPS) - Allow from Anywhere
   - Port 8001 (CV API) - Allow from Anywhere (or restrict to CV workers)

### 2.2 Initial Server Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Python and dependencies
apt install -y python3.11 python3.11-venv python3-pip nginx certbot python3-certbot-nginx

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Create application user
useradd -m -s /bin/bash surveilens
su - surveilens
```

### 2.3 Deploy CV Event API

```bash
# Create app directory
mkdir -p /home/surveilens/cv-api
cd /home/surveilens/cv-api

# Clone repository (or upload files)
git clone https://github.com/your-org/surveilens.git .

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Create .env file
cat > .env << EOF
CV_API_PORT=8001
SNOW_ACCOUNT=your_account
SNOW_USER=your_user
SNOW_PASS=your_password
SNOW_WH=COMPUTE_WH
SNOW_DB=SURVEILENS
SNOW_SCHEMA=CORE
DEMO_MODE=false
EOF

# Create systemd service
sudo cat > /etc/systemd/system/cv-api.service << EOF
[Unit]
Description=SurveiLens CV Event API
After=network.target

[Service]
User=surveilens
WorkingDirectory=/home/surveilens/cv-api
Environment="PATH=/home/surveilens/cv-api/venv/bin"
ExecStart=/home/surveilens/cv-api/venv/bin/python backend/cv_event_api.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable cv-api
sudo systemctl start cv-api

# Check status
sudo systemctl status cv-api
```

### 2.4 Configure Nginx for CV API

```bash
# Create Nginx config
sudo cat > /etc/nginx/sites-available/cv-api << EOF
server {
    listen 80;
    server_name your-api-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/cv-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL
sudo certbot --nginx -d your-api-domain.com
```

### 2.5 Deploy Web UI

```bash
# Create app directory
mkdir -p /home/surveilens/web
cd /home/surveilens/web

# Clone repository (or upload files)
git clone https://github.com/your-org/surveilens.git .

# Install dependencies
cd frontend
npm install

# Build for production
npm run build

# Create Nginx config for web UI
sudo cat > /etc/nginx/sites-available/surveilens-web << EOF
server {
    listen 80;
    server_name your-web-domain.com;

    root /home/surveilens/web/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/surveilens-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL
sudo certbot --nginx -d your-web-domain.com
```

## Option 3: Docker Deployment (Advanced)

### 3.1 Create Dockerfile for CV API

```dockerfile
# backend/Dockerfile.cv-api
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

ENV CV_API_PORT=8001
EXPOSE 8001

CMD ["python", "backend/cv_event_api.py"]
```

### 3.2 Create docker-compose.yml

```yaml
version: '3.8'

services:
  cv-api:
    build:
      context: .
      dockerfile: backend/Dockerfile.cv-api
    ports:
      - "8001:8001"
    environment:
      - CV_API_PORT=8001
      - SNOW_ACCOUNT=${SNOW_ACCOUNT}
      - SNOW_USER=${SNOW_USER}
      - SNOW_PASS=${SNOW_PASS}
      - SNOW_WH=${SNOW_WH}
      - SNOW_DB=${SNOW_DB}
      - SNOW_SCHEMA=${SNOW_SCHEMA}
      - DEMO_MODE=false
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "80:80"
      - "443:443"
    environment:
      - VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN}
      - VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID}
      - VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE}
      - VITE_BACKEND_BASE_URL=${VITE_BACKEND_BASE_URL}
    restart: unless-stopped
```

## Configure CV Workers

Update your CV workers to send events to the Vultr API:

```bash
# Set CV_API_URL environment variable
export CV_API_URL=https://your-api-domain.com/api/cv/event

# Or in your .env file
CV_API_URL=https://your-api-domain.com/api/cv/event
```

## Setup Snowflake

1. **Run Schema SQL**:
   ```bash
   # Connect to Snowflake
   snowsql -a your_account -u your_user

   # Run schema
   !source sql/snowflake_schema.sql
   ```

2. **Verify Tables**:
   ```sql
   USE DATABASE SURVEILENS;
   USE SCHEMA CORE;
   SHOW TABLES;
   SELECT COUNT(*) FROM CV_EVENTS;
   ```

## Testing

### Test CV Event API

```bash
# Health check
curl https://your-api-domain.com/health

# Send test event
curl -X POST https://your-api-domain.com/api/cv/event \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "test-123",
    "site_id": "site-01",
    "camera_id": "cam-01",
    "timestamp": 1234567890.0,
    "danger_level": "HIGH",
    "danger_score": 0.85,
    "gemini_json": {
      "people_count": 2,
      "weapons_detected": ["knife"],
      "actions_detected": ["punching"]
    },
    "transcript": "Help me!",
    "snapshot_files": []
  }'
```

### Test Web UI

1. Open https://your-web-domain.com
2. Login with Auth0
3. Verify dashboard loads
4. Check that events appear (if any)

## Monitoring

### Check CV API Logs

```bash
# Systemd logs
sudo journalctl -u cv-api -f

# Docker logs
docker logs -f cv-api
```

### Check Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

## Security Considerations

1. **API Authentication**: Consider adding API key authentication for CV workers
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Firewall**: Restrict API access to known CV worker IPs
4. **SSL/TLS**: Always use HTTPS in production
5. **Secrets Management**: Use Vultr's secret management or environment variables

## Cost Estimation

### Vultr App Platform
- **CV API**: ~$12/month (Basic plan)
- **Web UI**: ~$6/month (Static site)
- **Total**: ~$18/month

### Vultr VPS
- **2 CPU, 4GB RAM**: ~$24/month
- **Includes**: Both API and Web UI
- **Total**: ~$24/month

### Snowflake
- **Pay per use**: ~$2-5 per TB scanned
- **Storage**: ~$40 per TB per month
- **Estimated**: ~$50-100/month (depending on usage)

## Troubleshooting

### CV API not receiving events
1. Check firewall rules
2. Verify CV_API_URL is correct
3. Check API logs for errors
4. Test with curl

### Snowflake connection issues
1. Verify credentials in .env
2. Check Snowflake network policy
3. Test connection with snowsql
4. Check API logs for connection errors

### Web UI not loading
1. Check Nginx configuration
2. Verify build output exists
3. Check browser console for errors
4. Verify environment variables

## Next Steps

1. **Setup Monitoring**: Add monitoring (e.g., Datadog, New Relic)
2. **Add Logging**: Setup centralized logging (e.g., ELK, Loki)
3. **Backup Strategy**: Setup Snowflake backups
4. **Scaling**: Plan for horizontal scaling if needed
5. **CDN**: Add CDN for web UI assets

