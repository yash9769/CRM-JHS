# Bharat Cloud Production Deployment Guide

This guide provides step-by-step instructions for deploying the **Envista Cyber Defence CRM** application to **Bharat Cloud** (or any Linux VPS / Cloud VM).

---

## 1. Architecture Overview

- **Frontend**: Vite React SPA (compiled to static HTML/CSS/JS, served via Nginx).
- **Backend**: Fastify API running Node.js 20+ (Port 4000).
- **Database**: PostgreSQL 15+ (Local container or Bharat Cloud Managed PostgreSQL).
- **Reverse Proxy**: Nginx (Handles SSL/TLS termination, routes `/api/` to backend, routes `/` to SPA).

---

## 2. Environment Variables Reference

Create a production `.env` file (or set environment variables on your server):

```env
# Backend Database Connection URL
DATABASE_URL="postgresql://crm_user:StrongPassword123@localhost:5432/crm_prod?schema=public"

# Secure random string for signing JWT tokens (min 32 characters)
JWT_SECRET="generate-a-cryptographically-secure-random-string-here"

# Server Port
PORT=4000

# Node Environment
NODE_ENV="production"

# Allowed CORS Origins (comma separated, or leave blank to allow same-origin via Nginx proxy)
CORS_ORIGIN="https://crm.yourcompany.in"
```

---

## 3. Deployment Method A: Docker Compose (Recommended)

This is the cleanest and easiest deployment method. All services (PostgreSQL, Backend, Frontend + Nginx) are spun up in isolated containers.

### Step 1: Provision your Bharat Cloud Compute Instance
1. Launch an **Ubuntu 22.04 / 24.04 LTS** VM on Bharat Cloud (Recommended: 2 vCPU, 4 GB RAM or higher).
2. Attach a Static Public IP and configure Security Group / Firewall Rules:
   - **Port 22 (SSH)**: Accessible from your IP.
   - **Port 80 (HTTP)**: `0.0.0.0/0`
   - **Port 443 (HTTPS)**: `0.0.0.0/0`

### Step 2: Install Docker on the VM
SSH into your server:
```bash
ssh root@<YOUR_BHARAT_CLOUD_IP>

# Update packages and install Docker
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key and repo
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### Step 3: Clone Code & Configure Environment
```bash
# Clone the repository
git clone <YOUR_GIT_REPO_URL> /opt/crm
cd /opt/crm

# Create production .env file
cat << 'EOF' > .env
POSTGRES_USER=crm_admin
POSTGRES_PASSWORD=YourSuperSecurePassword123!
POSTGRES_DB=crm_prod
JWT_SECRET=ReplaceWith64CharRandomHexKey_e7f82b3c4d5e6f7a8b9c0d1e2f3a4b5c
CORS_ORIGIN=https://crm.yourcompany.in
EOF
```

### Step 4: Build and Start Containers
```bash
# Start all containers in the background
docker compose up -d --build

# Verify container statuses
docker compose ps
```

### Step 5: Run Database Migrations & Initial Seed
```bash
# Run Prisma migrations
docker compose exec backend npx prisma migrate deploy

# (Optional) Seed initial data, roles, and pipelines
docker compose exec backend npm run prisma:seed
```

### Step 6: Setup SSL/HTTPS with Let's Encrypt Certbot
To secure your domain with HTTPS:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 4. Deployment Method B: Native VM Setup (PM2 + Nginx + Postgres)

If you prefer running services directly on the host without Docker:

### Step 1: Install Node.js 20, PostgreSQL & Nginx
```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx git

# Install PM2 globally
sudo npm install -g pm2
```

### Step 2: Configure PostgreSQL Database
```bash
sudo -u postgres psql
```
Inside the PostgreSQL shell:
```sql
CREATE DATABASE crm_prod;
CREATE USER crm_user WITH ENCRYPTED PASSWORD 'YourSuperSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE crm_prod TO crm_user;
ALTER DATABASE crm_prod OWNER TO crm_user;
\q
```

### Step 3: Deploy Backend API
```bash
cd /opt/crm/backend

# Create .env
cat << 'EOF' > .env
DATABASE_URL="postgresql://crm_user:YourSuperSecurePassword123!@localhost:5432/crm_prod?schema=public"
JWT_SECRET="ReplaceWith64CharRandomHexKey_e7f82b3c4d5e6f7a8b9c0d1e2f3a4b5c"
PORT=4000
NODE_ENV="production"
EOF

# Install dependencies and build
npm ci
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run build

# Start with PM2
pm2 start dist/server.js --name "crm-backend"
pm2 save
pm2 startup
```

### Step 4: Build Frontend SPA
```bash
cd /opt/crm/frontend

# Install dependencies and build production static bundle
npm ci
npm run build
# The compiled bundle is in /opt/crm/frontend/dist
```

### Step 5: Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/crm`:
```nginx
server {
    listen 80;
    server_name crm.yourcompany.in; # Replace with your domain or IP

    root /opt/crm/frontend/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Serve Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API Requests to Fastify Backend
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Enable HTTPS with Free SSL Certificate
```bash
sudo certbot --nginx -d crm.yourcompany.in
```

---

## 5. Health Check & Monitoring

- **Health Check Endpoint**: `https://<YOUR_DOMAIN>/api/v1/health` (Returns `{"status": "ok"}`)
- **Backend Logs**:
  - Docker: `docker compose logs -f backend`
  - PM2: `pm2 logs crm-backend`
- **Database Backup Cron (Automated Daily Backups)**:
```bash
# Add to crontab (crontab -e)
0 2 * * * pg_dump -U crm_user -h localhost crm_prod | gzip > /opt/backups/crm_$(date +\%Y\%m\%d).sql.gz
```
