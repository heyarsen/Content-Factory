# Fix Supabase Email Not Sending

## Quick Checklist

### 1. Check Supabase Email Settings

Go to Supabase Dashboard → **Authentication** → **Email Templates**

**Important Settings:**
- ✅ **Enable email confirmations** should be ON
- ✅ **Enable email change confirmations** should be ON (optional)
- ✅ Check that email provider is configured

### 2. Check Rate Limits

Supabase has rate limits on emails:
- **Free tier**: ~4 emails per hour per user
- If you've hit the limit, wait 1 hour before trying again

### 3. Verify Redirect URLs Match Exactly

In **Authentication** → **URL Configuration**:

**Site URL:**
```
https://app.contentfabrica.com
```

**Redirect URLs** (add all of these):
```
https://app.contentfabrica.com
https://app.contentfabrica.com/verify-email
https://app.contentfabrica.com/reset-password
https://app.contentfabrica.com/login
```

⚠️ **Important**: The redirect URL in your code MUST exactly match one of these URLs (including https://, no trailing slash issues).

### 4. Check Railway Environment Variables

Make sure these are set correctly:
```
CORS_ORIGIN=https://app.contentfabrica.com
FRONTEND_URL=https://app.contentfabrica.com
```

### 5. Check Email Provider

Go to **Settings** → **Auth** → Check if:
- Email provider is configured (Supabase sends via their default service)
- SMTP is not required (unless you set up custom SMTP)

### 6. Try Using Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Find your user
3. Click **Send verification email** manually
4. Check if email arrives

### 7. Check Spam Folder

Emails from Supabase often go to spam. Check:
- Spam/Junk folder
- Promotions tab (Gmail)
- Add `noreply@mail.app.supabase.io` to contacts

## Common Issues

### Issue: "One-time token not found"
**Cause**: Redirect URL doesn't match Supabase configuration
**Fix**: Ensure exact URL match in Supabase dashboard

### Issue: No emails at all
**Cause**: Email confirmations disabled or rate limited
**Fix**: 
1. Check email confirmation is enabled
2. Wait 1 hour if rate limited
3. Check spam folder

### Issue: User already exists
**Cause**: Trying to sign up again with same email
**Fix**: Use "Resend verification email" or try logging in

## Testing

1. **Wait 1 hour** if you've been testing multiple times
2. **Create a new test account** with a different email
3. **Check Supabase logs** for email send confirmations
4. **Use Supabase dashboard** to manually resend if needed

