# BROMISE - Testing & Deployment Guide

## 🔧 Fixes Applied

### Critical Bug Fixes ✅
1. **Sync Adapter Race Condition** - Added try-catch to prevent sync with failed local operations
2. **Memory Leak in Health Timer** - Timer properly cleared on logout with logging
3. **Server Security Hole** - Fixed subtasks DELETE query to include user_id check
4. **Production Route Bug** - Fixed wildcard route from `{*splat}` to `*`
5. **Date Rollover Issue** - Improved to 10s intervals + exact midnight timer
6. **CORS Security** - Restricted to specific origins in production
7. **SQL Injection Protection** - Added taskId validation on reorder endpoint
8. **localStorage Quota** - Added try-catch with user alerts on all save operations
9. **Error Handling** - Added try-catch to all App.tsx async handlers
10. **Database Indexes** - Added 9 indexes for performance optimization

### Security Improvements ✅
- CORS restricted to allowed origins
- Request body size limit (10mb)
- Input validation on reorder endpoint
- Better error logging with warnings

---

## 🚀 Pre-Deployment Checklist

### 1. Install Dependencies & Fix Vulnerabilities
```bash
# Install dependencies
npm install

# Fix security vulnerabilities
npm audit fix

# If breaking changes, review manually
npm audit
```

### 2. Environment Configuration

**Development (.env):**
```env
VITE_GOOGLE_CLIENT_ID=your-dev-google-client-id
VITE_API_BASE_URL=http://localhost:3001

PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

TURSO_DATABASE_URL=file:./data/bromise.db
TURSO_AUTH_TOKEN=

JWT_SECRET=dev-secret-min-32-chars-for-testing-only
```

**Production (.env.production):**
```env
VITE_GOOGLE_CLIENT_ID=your-production-google-client-id
VITE_API_BASE_URL=https://your-domain.com

PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

TURSO_DATABASE_URL=libsql://your-turso-db.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

JWT_SECRET=your-super-secure-random-64-char-production-secret
```

### 3. Build & Test Locally

```bash
# Type check
npm run build

# Run linter
npm run lint

# Start development server (frontend)
npm run dev

# In another terminal, start backend
npm run dev:server

# Or run both together
npm run dev:all
```

### 4. Test Checklist

**Authentication:**
- [ ] Google login works
- [ ] Token persists on refresh
- [ ] Logout clears all data
- [ ] 401 handling redirects to login

**Task Management:**
- [ ] Create task
- [ ] Edit task
- [ ] Delete task (soft archive)
- [ ] Add task to today
- [ ] Remove task from today
- [ ] Mark task complete
- [ ] Drag and drop reorder

**Time Slots:**
- [ ] Assign time slot to task
- [ ] Edit time slot
- [ ] Remove time slot
- [ ] Multiple slots for same task
- [ ] Mark slot as complete

**Categories:**
- [ ] Create category
- [ ] Edit category
- [ ] Delete category (move tasks)
- [ ] Delete category (delete tasks)
- [ ] Filter by category

**Offline Mode:**
- [ ] Disconnect network
- [ ] Create/edit tasks offline
- [ ] Verify offline banner appears
- [ ] Reconnect network
- [ ] Verify sync queue drains
- [ ] Verify data synced to server

**Date Handling:**
- [ ] Change date selector
- [ ] Leave tab open overnight (test midnight rollover)
- [ ] Return to tab after hours (auto-rollover check)

**Progress & Analytics:**
- [ ] View progress charts
- [ ] View history heatmap
- [ ] Check streak calculation
- [ ] Export data
- [ ] Import data

**Themes:**
- [ ] Switch themes
- [ ] Winter Arc theme with snow
- [ ] Dark/light mode

---

## 🧪 Manual Testing Script

### Test 1: Complete Task Flow
```
1. Login with Google
2. Create category "Work" (blue icon)
3. Create task "Test Bug Fixes" in Work category
4. Add task to Today
5. Assign time slot 09:00 - 10:00
6. Mark slot complete
7. Verify completion shows in stats
```

### Test 2: Offline Sync
```
1. Open DevTools > Network > Offline
2. Create task "Offline Task"
3. Add to today
4. Verify "Offline mode" banner
5. Go back online
6. Wait 15s for health check
7. Verify banner disappears
8. Check server data (refresh page)
9. Verify task synced
```

### Test 3: Midnight Rollover
```
1. Set system time to 23:59
2. Add tasks to today
3. Wait for 00:00
4. Verify date auto-advances
5. Verify yesterday's tasks cleared from today
6. Verify recurring tasks appear
```

### Test 4: Error Handling
```
1. Stop server
2. Try to create task
3. Verify offline mode kicks in
4. Create multiple tasks offline
5. Start server
6. Verify all tasks sync
```

### Test 5: localStorage Quota
```
1. Create 500+ tasks (use API/script if needed)
2. Try to create more
3. Verify no crash
4. Verify error alert shows if quota exceeded
```

---

## 🚢 Deployment Options

### Option 1: Render (Recommended - Free Tier Available)

**Setup:**
1. Push code to GitHub
2. Create Render account
3. Create new Web Service
4. Connect GitHub repo
5. Set environment variables
6. Deploy

**Render Configuration:**
```yaml
# render.yaml (already in project)
services:
  - type: web
    name: bromise
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: VITE_GOOGLE_CLIENT_ID
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: TURSO_DATABASE_URL
        sync: false
      - key: TURSO_AUTH_TOKEN
        sync: false
```

**Turso Database Setup:**
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create bromise-prod

# Get database URL
turso db show bromise-prod --url

# Create auth token
turso db tokens create bromise-prod

# Add to Render environment variables
```

### Option 2: Vercel + Separate Backend

**Frontend (Vercel):**
```bash
npm install -g vercel
vercel login
vercel --prod
```

**Backend (Railway/Render):**
- Deploy server folder separately
- Update VITE_API_BASE_URL to backend URL

### Option 3: VPS (DigitalOcean, Linode, etc.)

**Setup Script:**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repo
git clone https://github.com/your-username/bromise.git
cd bromise

# Install dependencies
npm install

# Build
npm run build

# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start server/index.js --name bromise
pm2 save
pm2 startup

# Setup Nginx reverse proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/bromise
```

**Nginx Config:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 4: Docker

**Dockerfile** (create this):
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "start"]
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  bromise:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - TURSO_DATABASE_URL=${TURSO_DATABASE_URL}
      - TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN}
      - JWT_SECRET=${JWT_SECRET}
      - VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

**Deploy:**
```bash
docker-compose up -d
```

---

## 🔍 Post-Deployment Verification

### Health Checks
```bash
# Check server health
curl https://your-domain.com/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Google OAuth Setup
1. Go to Google Cloud Console
2. Create OAuth 2.0 Client ID
3. Add authorized origins:
   - https://your-domain.com
4. Add authorized redirect URIs:
   - https://your-domain.com
5. Copy Client ID to environment variables

### Database Verification
```bash
# Check if indexes were created
turso db shell bromise-prod
> .indexes

# Should show:
# - idx_categories_user
# - idx_tasks_user
# - idx_tasks_category
# - idx_daily_plans_user_date
# - idx_daily_plans_task
# - idx_completions_user_date
# - idx_completions_task_date
# - idx_recurrence_task
# - idx_subtasks_task
```

### Performance Testing
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test API performance
ab -n 1000 -c 10 https://your-domain.com/api/health

# Check response times (should be <100ms after fixes)
```

---

## 📊 Monitoring Setup (Recommended)

### 1. Error Tracking - Sentry
```bash
npm install @sentry/react @sentry/node
```

Add to `src/main.tsx`:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: import.meta.env.MODE,
});
```

### 2. Analytics - Plausible/PostHog
```bash
npm install posthog-js
```

### 3. Uptime Monitoring
- UptimeRobot (free)
- Pingdom
- StatusCake

---

## 🐛 Troubleshooting

### Issue: White Screen on Production
**Solution:**
- Check browser console for errors
- Verify VITE_API_BASE_URL is set correctly
- Check CORS allowed origins include your domain

### Issue: 401 Unauthorized Errors
**Solution:**
- Verify JWT_SECRET is set on server
- Clear browser localStorage
- Re-login with Google

### Issue: Offline Sync Not Working
**Solution:**
- Check health check endpoint: `/api/health`
- Verify server is accessible
- Check browser console for network errors

### Issue: Slow Performance
**Solution:**
- Verify database indexes were created
- Check server logs for slow queries
- Monitor server resources (CPU/RAM)

### Issue: Database Connection Errors
**Solution:**
- Verify TURSO_DATABASE_URL format
- Check TURSO_AUTH_TOKEN is valid
- Test connection: `turso db shell bromise-prod`

---

## 🎯 Next Steps After Deployment

1. **Setup Monitoring** - Add Sentry for error tracking
2. **Custom Domain** - Add your domain + SSL certificate
3. **Database Backups** - Setup automated backups
4. **CI/CD** - Setup GitHub Actions for auto-deploy
5. **Load Testing** - Stress test with realistic user loads
6. **User Feedback** - Gather feedback and iterate

---

## 📝 Development Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
# Test locally with npm run dev:all

# Build and verify
npm run build
npm run lint

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push to GitHub
git push origin feature/new-feature

# Create Pull Request
# After review, merge to main
# Deploy automatically (if CI/CD setup)
```

---

## 🎓 Additional Resources

- [Turso Documentation](https://docs.turso.tech/)
- [Render Deployment Guide](https://render.com/docs)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [React PWA Guide](https://web.dev/progressive-web-apps/)
- [Vite Production Build](https://vitejs.dev/guide/build.html)

---

**Questions? Issues?**
Check ANALYSIS.md for detailed bug reports and optimization recommendations.

Good luck with your deployment! 🚀
