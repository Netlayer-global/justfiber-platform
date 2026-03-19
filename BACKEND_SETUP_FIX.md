# Backend Configuration Guide

## Current Status

The backend server is failing to start due to missing required environment variables:

```
ZodError: Missing required environment variables:
- REDIS_URL
- JWT_ACCESS_SECRET  
- JWT_REFRESH_SECRET
```

## Quick Fix

### Step 1: Set Environment Variables

Add these to your backend `.env` file or system environment:

```env
# Redis cache (required)
REDIS_URL=redis://localhost:6379

# JWT secrets (generate new ones, min 32 characters each)
JWT_ACCESS_SECRET=your-super-secret-access-token-key-32chars-minimum
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-32chars-minimum

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/justfiber_db

# Optional but recommended
ENVIRONMENT=production
PORT=4000
LOG_LEVEL=info
```

### Step 2: Generate Secure Secrets

Use this command to generate secure random secrets:

```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -InputObject (0..99999999) -Count 256 | ConvertTo-Json)))
```

### Step 3: Start Redis

```bash
# If using Docker
docker run -d -p 6379:6379 redis:alpine

# Or if Redis installed locally
redis-server

# Or check if already running
redis-cli ping
```

### Step 4: Start Backend

```bash
# From backend directory
npm install
npm start
```

Should see: ✅ Server running on http://127.0.0.1:4000

## Frontend Configuration

Once backend is running, update frontend environment:

```bash
# frontend/admin-console/.env.local
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
```

## Then Start Frontend

```bash
cd frontend/admin-console
npm install
npm run dev
# Open http://localhost:3000
```

## Complete Test Flow

1. ✅ Backend running at 4000
2. ✅ Frontend running at 3000
3. ✅ Login with admin credentials
4. ✅ Navigate all 15+ modules
5. ✅ Test API calls to backend

## Production Deployment

For production, use secure methods to store secrets:

- **Vercel**: Use Environment Variables in project settings
- **AWS**: Use Systems Manager Parameter Store or Secrets Manager
- **Docker**: Use Docker secrets or volume mounts
- **Kubernetes**: Use Secrets resource
- **Traditional Server**: Use systemd environment files or `/etc/environment`

Never commit secrets to git!

## Troubleshooting

### Backend won't start
```bash
# Check all required env vars are set
echo $REDIS_URL
echo $JWT_ACCESS_SECRET
echo $JWT_REFRESH_SECRET

# Check Redis is running
redis-cli ping
# Should respond: PONG
```

### Frontend can't reach backend
```bash
# Check backend is running
curl http://127.0.0.1:4000/api/v1/admin/health

# Check frontend env var
echo $NEXT_PUBLIC_API_BASE_URL

# Check network tab in DevTools for failed requests
```

### Login fails
```bash
# Verify JWT secrets match
# Check backend auth endpoint returns token
# Check token is stored in localStorage
# Check Authorization header is sent
```

---

**Once both backend and frontend are configured and running, the admin panel is fully operational and ready for use.**
