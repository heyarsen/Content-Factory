# Content Factory - Quick Fix Guide

🚨 **URGENT FIXES FOR PRODUCTION DEPLOYMENT**

## 1. Environment Setup (CRITICAL)

### Step 1: Create .env file
```bash
cp .env.example .env
```

### Step 2: Configure required variables
Edit `.env` file with these PRODUCTION values:

```env
# Server Configuration
PORT=4000
NODE_ENV=production

# Frontend URL (CHANGE THIS TO YOUR ACTUAL DOMAIN)
FRONTEND_URL=https://contentfabrica.com

# JWT Secret (GENERATE A SECURE ONE)
JWT_SECRET=7x9k2m5n8q1w4e6r9t0y2u5i8o1p3a6s9d2f5g8h1j4k7l0z3x6c9v2b5n8m1q4w7e0r9t

# Database - REQUIRED FOR PRODUCTION
DATABASE_URL=postgresql://username:password@localhost:5432/contentfabrica

# API Keys (GET THESE FROM RESPECTIVE SERVICES)
HEYGEN_KEY=your_actual_heygen_api_key
UPLOADPOST_KEY=your_actual_uploadpost_api_key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@contentfabrica.com

# Debug (set to false for production)
DEBUG=false
```

## 2. Database Setup (CRITICAL)

### Install PostgreSQL (if not installed)
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql
brew services start postgresql

# Windows
# Download and install from https://www.postgresql.org/download/windows/
```

### Create Database
```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE contentfabrica;
CREATE USER contentfabrica_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE contentfabrica TO contentfabrica_user;
\q
```

### Run Migrations
```bash
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run seed
```

## 3. Production Deployment Fixes

### Option A: Railway (Recommended)

1. **Connect to Railway:**
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub repository
   - Deploy the `Content-Factory` repo

2. **Set Environment Variables in Railway:**
   ```
   NODE_ENV=production
   JWT_SECRET=your-generated-secret-here
   DATABASE_URL=postgresql://...
   HEYGEN_KEY=your-key
   UPLOADPOST_KEY=your-key
   FRONTEND_URL=https://your-app-name.up.railway.app
   ```

3. **Auto-deployment:**
   - Railway will automatically deploy on git push
   - Database will be created automatically

### Option B: Manual Server Deployment

```bash
# On your server
git clone https://github.com/heyarsen/Content-Factory.git
cd Content-Factory
npm install
npm run build

# Set up environment variables
cp .env.example .env
# Edit .env with production values

# Run database migrations
npx prisma migrate deploy
npx prisma generate
npm run seed

# Start production server
npm start
```

## 4. Authentication Fix (IMMEDIATE)

### Problem: 401 Unauthorized errors

**Root Cause:** Frontend trying to access wrong API URL

**Solution:** Update API URL detection

The app automatically detects the API URL based on environment:
- **Development:** `http://localhost:4000`
- **Production:** Same domain as frontend

### Demo Credentials (Development Only)
- **Email:** `demo@contentfabrica.com`
- **Password:** `demo123`

### Production User Setup
After running `npm run seed`, you'll have:
- **Email:** `admin@contentfabrica.com`
- **Password:** `admin123`

## 5. Domain Configuration

### For contentfabrica.com

1. **Update DNS:**
   - Point A record to your server IP
   - Set up SSL certificate

2. **Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name contentfabrica.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name contentfabrica.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 6. Quick Health Check

### Test API Server
```bash
curl http://localhost:4000/api/health
# Should return: {"status":"ok","timestamp":"...","users":1,"workspaces":1}
```

### Test Frontend
- Open `http://localhost:5173`
- Try logging in with demo credentials
- Check browser console for errors

## 7. Common Issues & Solutions

### Issue: "Database connection failed"
**Solution:**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start if not running
sudo systemctl start postgresql

# Verify database exists
psql -U contentfabrica_user -d contentfabrica -h localhost
```

### Issue: "JWT token invalid"
**Solution:**
- Clear browser localStorage
- Ensure JWT_SECRET is set and consistent
- Check token expiration in browser dev tools

### Issue: "API keys not working"
**Solution:**
- Verify HeyGen and UploadPost API keys are valid
- Check API key permissions and quotas
- Test keys independently with curl

## 8. Production Checklist

- [ ] Environment variables configured
- [ ] Database created and migrated
- [ ] API keys obtained and tested
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] Server security configured (firewall, etc.)
- [ ] Backup strategy implemented
- [ ] Error monitoring set up

## 9. Emergency Contact

If the site is still not working after following this guide:

1. **Check server logs:**
   ```bash
   # Application logs
   tail -f logs/app.log
   
   # System logs
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Browser debugging:**
   - Open Developer Tools (F12)
   - Check Console tab for JavaScript errors
   - Check Network tab for failed API requests

3. **Quick restart:**
   ```bash
   # Restart all services
   sudo systemctl restart postgresql
   sudo systemctl restart nginx
   npm run dev  # or npm start for production
   ```

---

**Last Updated:** October 31, 2025
**Status:** Ready for deployment
**Next Steps:** Configure production environment variables and deploy