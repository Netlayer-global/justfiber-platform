# Backend Startup - What's Required to Test the Admin Console

## Current Status

The JustFiber admin console frontend is **fully built and wired to real APIs**, but it cannot function without a running backend server.

**Current Error:**
```
Error: MONGODB_URI or MONGO_URI is required
```

This means the backend cannot start. This is not a bug - it's a requirement.

---

## What Needs to Happen

### 1. MongoDB Database

The backend requires a MongoDB instance to store all application data:

#### Option A: Local MongoDB (for development)
```bash
# Install MongoDB locally (macOS with Homebrew)
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify it's running
mongosh

# You should see the MongoDB shell
test> 
```

Connection string: `mongodb://localhost:27017/justfiber`

#### Option B: MongoDB Atlas (Cloud - Recommended)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster (free tier available)
4. Get connection string that looks like:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/justfiber
   ```

### 2. Redis Cache

The backend uses Redis for caching and session management:

#### Option A: Local Redis (for development)
```bash
# Install Redis locally (macOS with Homebrew)
brew install redis

# Start Redis
brew services start redis

# Verify it's running
redis-cli ping
# Should return: PONG
```

Connection string: `redis://localhost:6379`

#### Option B: Cloud Redis (Optional for production)
- Upstash Redis: https://upstash.com
- AWS ElastiCache
- Azure Cache for Redis

### 3. Environment Variables

Create a `.env` file in the project root:

```bash
# Database
MONGODB_URI="mongodb+srv://youruser:yourpassword@cluster.mongodb.net/justfiber"

# Cache
REDIS_URL="redis://localhost:6379"

# JWT Secrets (must be 32+ characters, change these!)
JWT_ACCESS_SECRET="your-very-secure-access-token-secret-key-at-least-32-chars"
JWT_REFRESH_SECRET="your-very-secure-refresh-token-secret-key-at-least-32-chars"

# Server
PORT=4000
NODE_ENV=development

# Optional: Log level
LOG_LEVEL=info
```

**Security Warning:** These secret keys should be:
- At least 32 characters long
- Random and unique
- Changed in production
- Never committed to git
- Different for each environment

Generate secure secrets:
```bash
# macOS/Linux
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use an online tool: https://generate-random.org/encryption-keys-generator
```

---

## Step-by-Step Startup Guide

### Step 1: Prepare MongoDB

Choose one option:

**Local Development:**
```bash
brew services start mongodb-community
# Verify: mongosh
```

**Cloud (MongoDB Atlas):**
- Create account and cluster at https://atlas.mongodb.com
- Copy connection string
- Add to `.env` as `MONGODB_URI`

### Step 2: Prepare Redis

**Local Development:**
```bash
brew services start redis
# Verify: redis-cli ping
```

### Step 3: Create `.env` File

In project root, create `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/justfiber
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your-32-character-secret-key-here-make-it-random
JWT_REFRESH_SECRET=your-32-character-refresh-secret-key-random
PORT=4000
NODE_ENV=development
```

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Start Backend

```bash
npm run dev
```

You should see:
```
[INFO] Server running on http://localhost:4000
[INFO] Connected to MongoDB
[INFO] Redis connected
[INFO] Admin API ready
```

### Step 6: Verify Backend Health

```bash
# In another terminal
curl http://localhost:4000/health/live

# Should return:
# {"status":"ok"}
```

### Step 7: Start Frontend

In another terminal:
```bash
cd frontend/admin-console
npm install
npm run dev
```

Frontend will start on `http://localhost:3000`

### Step 8: Test Login

1. Open `http://localhost:3000/auth/login`
2. Use test admin credentials (from backend seeds or create one)
3. Should redirect to dashboard
4. Dashboard should load data from backend APIs

---

## Troubleshooting

### MongoDB Connection Refused
```
MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
```bash
# Check if MongoDB is running
brew services list

# If not running, start it
brew services start mongodb-community

# Verify it's listening
nc -zv localhost 27017
```

### Redis Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Check if Redis is running
brew services list

# If not running, start it
brew services start redis

# Verify it's listening
redis-cli ping
```

### JWT Secret Too Short
```
Error: JWT_ACCESS_SECRET must be at least 32 characters
```

**Solution:**
```bash
# Generate a 32-character secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy output to .env
```

### MONGODB_URI Not Set
```
Error: MONGODB_URI or MONGO_URI is required
```

**Solution:**
Make sure `.env` file exists in project root with:
```env
MONGODB_URI=mongodb://localhost:27017/justfiber
```

### Port 4000 Already in Use
```
Error: listen EADDRINUSE :::4000
```

**Solution:**
```bash
# Change port in .env
PORT=4001

# Or kill existing process
lsof -ti:4000 | xargs kill -9
```

---

## What Happens After Backend Starts

Once the backend is running with MongoDB and Redis:

1. **Admin Console is Ready** - You can log in and test
2. **Data Flows** - Dashboard loads real data from backend
3. **Operations Work** - Customer suspend/resume actions execute
4. **Billing Shows** - Real invoices and payments display
5. **Tickets Can Be Created** - Support system becomes functional

You can then:
- Navigate all 5 fully-built modules (Auth, Dashboard, Customers, Billing, Tickets)
- Test real backend workflows
- Identify and fix backend bugs
- Plan next modules

---

## Minimal Setup (Quick Start)

If you just want to get things running NOW:

```bash
# 1. Start MongoDB locally
brew services start mongodb-community

# 2. Start Redis locally
brew services start redis

# 3. Create .env in project root
cat > .env << 'EOF'
MONGODB_URI=mongodb://localhost:27017/justfiber
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=dev-secret-key-minimum-32-characters-long-for-now
JWT_REFRESH_SECRET=dev-refresh-secret-key-32-minimum-characters-for-now
PORT=4000
NODE_ENV=development
EOF

# 4. Install and start backend
npm install
npm run dev

# 5. In another terminal, start frontend
cd frontend/admin-console
npm install
npm run dev

# 6. Open http://localhost:3000/auth/login
```

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Use MongoDB Atlas (not local)
- [ ] Use Upstash or AWS Redis (not local)
- [ ] Generate new, strong JWT secrets
- [ ] Store secrets in environment variables (not .env file)
- [ ] Enable HTTPS
- [ ] Configure CORS for your domain
- [ ] Set NODE_ENV=production
- [ ] Enable monitoring and logging
- [ ] Backup MongoDB regularly
- [ ] Test all workflows

---

## Database Schema

On first startup with empty MongoDB, the backend will create collections for:
- admin_users
- customers
- services
- invoices
- payments
- tickets
- devices
- network_nodes
- integrations
- audit_logs
- (and more)

No manual schema setup needed - the app handles it automatically.

---

## Test Data

After backend starts, you can:

1. **Create test admin account via API** (documented in ADMIN_BACKEND_CONTRACT.md)
2. **Seed test data** using provided scripts (if available)
3. **Use Postman collection** to generate test records

Then admin console will show real data for testing.

---

## What's NOT Needed Right Now

- SMS provider (optional, for notifications)
- Email provider (optional, for notifications)
- Aadhaar KYC provider (optional, for KYC)
- Payment gateway (optional, for actual payments)
- WhatsApp API (optional, for messaging)

These are all integration features that can be configured later. The core admin console works without them.

---

## Final Check

You'll know everything is working when:

1. Backend starts without errors
2. Frontend loads at http://localhost:3000
3. Login page appears
4. You can enter admin credentials
5. Dashboard loads with data
6. Customer list shows records
7. Billing shows invoices
8. Tickets can be created

If all 7 of these work, you have a fully functional admin console ready to test backend features.

---

## Questions?

- Backend fails to start? → Check MONGODB_URI in .env
- Can't see data? → Verify backend is running on port 4000
- Login not working? → Check backend logs for auth errors
- Buttons don't work? → Check browser console for API errors

All answers are in the backend logs when something fails.
