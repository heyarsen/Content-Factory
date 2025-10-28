# Content Fabrica - Troubleshooting Guide

## Authentication Issues

### Problem: 401 Unauthorized Error on Login

If you're seeing errors like:
```
POST https://contentfabrica.com/api/auth/login 401 (Unauthorized)
{error: 'Invalid credentials'}
```

### Solutions:

#### Option 1: Development Environment (Recommended)

1. **Run the development servers locally:**
   ```bash
   git clone https://github.com/heyarsen/Content-Factory.git
   cd Content-Factory
   npm install
   npm run dev
   ```

2. **Access the app at the development URL:**
   - Open `http://localhost:5173` in your browser
   - **DO NOT** use `https://contentfabrica.com` for development

3. **Use the demo credentials:**
   - **Email**: `demo@contentfabrica.com`
   - **Password**: `demo123`

#### Option 2: Production Environment

If you're accessing the app via `https://contentfabrica.com`, make sure:

1. **The production server is running** and has the same authentication setup
2. **The demo user exists** on the production database
3. **Environment variables are set** correctly on production

### Environment Setup

1. **Copy the environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your settings:**
   ```env
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   FRONTEND_URL=http://localhost:5173
   PORT=4000
   ```

### Debug Information

The updated AuthContext now provides detailed console logging:

- Check **browser console** for API URL detection
- Check **server console** for authentication attempts
- Verify **network tab** in browser dev tools

### Demo Credentials

**Development Server:**
- Email: `demo@contentfabrica.com`
- Password: `demo123`

**Registration:**
You can also register a new account with any valid email and password.

### Common Issues

1. **Wrong URL**: Make sure you're accessing `localhost:5173` for development
2. **Server not running**: Ensure both frontend and backend servers are active
3. **Environment mismatch**: Don't mix production URLs with development credentials
4. **Cache issues**: Clear browser cache and local storage if needed

### Server Status Check

Visit `http://localhost:4000/api/health` to check if the server is running:

```json
{
  "status": "ok",
  "timestamp": "2025-10-28T18:30:00.000Z",
  "users": 1,
  "workspaces": 1
}
```

### Contact

If issues persist, check the console logs in both browser and server for detailed error messages.