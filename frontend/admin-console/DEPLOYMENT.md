# Deployment Guide

## Prerequisites

- Node.js 18+
- npm/yarn/pnpm package manager
- Backend API running (JustFiber backend)
- Git (for version control)

## Local Development

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev

# Open http://localhost:3000
```

## Production Build

```bash
# Build for production
npm run build

# Test production build locally
npm start
```

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel is the creator of Next.js and provides the best deployment experience.

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel deploy --prod

# Or set environment variables first
vercel env add NEXT_PUBLIC_API_BASE_URL
vercel deploy --prod
```

**Vercel Dashboard Setup:**
1. Connect GitHub repository
2. Add environment variables in Project Settings → Environment Variables
3. Configure automatic deployments on git push
4. View deployment logs in Deployments section

### Option 2: Docker & Cloud Platforms

#### Build Docker Image

```dockerfile
# Dockerfile
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY . .
RUN npm ci
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
RUN chown -R nextjs:nodejs .

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t justfiber-admin-console:latest .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_BASE_URL=http://api:4000 justfiber-admin-console:latest
```

#### Deploy to AWS EC2

```bash
# SSH into EC2 instance
ssh -i your-key.pem ec2-user@your-instance-ip

# Install Node.js
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Clone repository
git clone https://github.com/honey728989/justfiber-platform.git
cd frontend/admin-console

# Install and build
npm install
npm run build

# Install PM2 for process management
sudo npm install -g pm2

# Start application
pm2 start npm --name "admin-console" -- start

# Setup auto-restart
pm2 startup
pm2 save
```

#### Deploy to AWS Amplify

```bash
# Install AWS CLI
aws configure

# Deploy with Amplify
amplify init
amplify hosting add
amplify publish
```

#### Deploy to Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create justfiber-admin-console

# Set environment variables
heroku config:set NEXT_PUBLIC_API_BASE_URL=https://api.example.com

# Deploy
git push heroku main
```

#### Deploy to Google Cloud Run

```bash
# Build with Cloud Build
gcloud builds submit --tag gcr.io/PROJECT-ID/admin-console

# Deploy to Cloud Run
gcloud run deploy admin-console \
  --image gcr.io/PROJECT-ID/admin-console \
  --platform managed \
  --region us-central1 \
  --set-env-vars NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

### Option 3: Traditional Server (Nginx + PM2)

```bash
# SSH into server
ssh user@your-server

# Install Node.js
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Nginx
sudo apt-get install -y nginx

# Clone and setup
cd /var/www
git clone https://github.com/honey728989/justfiber-platform.git
cd frontend/admin-console
npm install
npm run build

# Configure Nginx
sudo nano /etc/nginx/sites-available/admin-console
```

Nginx config:
```nginx
upstream admin_console {
  server localhost:3000;
}

server {
  listen 80;
  server_name admin.example.com;

  location / {
    proxy_pass http://admin_console;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/admin-console /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Start application with PM2
cd /var/www/frontend/admin-console
npm install -g pm2
pm2 start npm --name "admin" -- start
pm2 startup
pm2 save
```

## Environment Variables

| Variable | Required | Default | Example |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | - | `http://127.0.0.1:4000` |

## SSL/TLS Setup

### With Vercel
- Automatic HTTPS with SSL certificate

### With Nginx + Certbot

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d admin.example.com

# Update Nginx config
sudo certbot --nginx -d admin.example.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

## Monitoring & Logging

### Application Logs

```bash
# With PM2
pm2 logs admin-console

# Docker
docker logs container-id

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Performance Monitoring

```bash
# Install monitoring tools
npm install --save-dev @next/bundle-analyzer

# Analyze bundle
npm run analyze
```

## Backup & Recovery

```bash
# Backup database and configuration
tar -czf admin-console-backup.tar.gz .env.local

# Store in S3
aws s3 cp admin-console-backup.tar.gz s3://backups/

# Restore
tar -xzf admin-console-backup.tar.gz
```

## Scaling

### Horizontal Scaling

1. Deploy multiple instances behind load balancer
2. Use session storage (Redis) for token management
3. Configure load balancer health checks

### Vertical Scaling

1. Increase server resources (CPU, RAM)
2. Optimize Next.js build: `npm run build --profile`
3. Enable caching headers in Nginx

## Troubleshooting

### High Memory Usage
```bash
# Monitor memory
pm2 monit

# Reduce memory usage
NODE_OPTIONS="--max_old_space_size=512" npm start
```

### API Connection Errors
- Verify backend is running
- Check firewall rules
- Confirm `NEXT_PUBLIC_API_BASE_URL` is correct
- Test with curl: `curl http://backend-url/api/v1/health`

### Build Failures
```bash
# Clear cache
rm -rf .next

# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## Security Checklist

- [ ] API base URL uses HTTPS in production
- [ ] Environment variables not committed to git
- [ ] CORS properly configured on backend
- [ ] Rate limiting enabled on API
- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] Regular dependency updates: `npm audit fix`
- [ ] SSL/TLS certificate valid and auto-renewed
- [ ] Firewall rules restrict API access

## Support

For deployment issues, refer to:
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Docker Documentation](https://docs.docker.com/)
