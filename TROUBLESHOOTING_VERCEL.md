# Troubleshooting Vercel Deployment

## Error: DEPLOYMENT_NOT_FOUND

This error typically occurs when:
1. The deployment failed during build
2. Environment variables are missing
3. The project wasn't properly linked

## Step-by-Step Fix

### 1. Verify Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and ensure ALL of these are set:

**Required Variables:**
```
MONGODB_URI
MONGODB_DB_NAME
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
NEXT_PUBLIC_APP_URL
```

**Important for MONGODB_URI:**
- Format: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/attendance_db?retryWrites=true&w=majority`
- Replace username, password, and cluster URL with your actual values
- For local MongoDB: `mongodb://localhost:27017/attendance_db`
- Ensure MongoDB Atlas network access allows Vercel IPs (0.0.0.0/0 for all)

### 2. Check Build Logs

1. Go to your Vercel project dashboard
2. Click on the failed deployment
3. Check the "Build Logs" tab
4. Look for specific error messages

### 3. Common Build Errors & Fixes

#### Error: "Module not found"
- **Fix**: Ensure `package.json` has all dependencies
- Run `npm install` locally to verify

#### Error: "Environment variable not found"
- **Fix**: Add all required environment variables in Vercel dashboard
- Make sure variable names match exactly (case-sensitive)

#### Error: "MongoDB connection error" or "MongoNetworkError"
- **Fix**: 
  - Verify MongoDB URI is correct and properly formatted
  - Check MongoDB Atlas network access allows connections from anywhere (0.0.0.0/0)
  - Verify username and password in connection string are correct
  - Ensure MongoDB service is running (for local MongoDB)

#### Error: "Authentication failed"
- **Fix**: Check ADMIN_USERNAME and ADMIN_PASSWORD are set correctly

### 4. Redeploy

After fixing issues:
1. Go to Deployments tab
2. Click "..." on latest deployment
3. Click "Redeploy"
4. Or push a new commit to trigger automatic deployment

### 5. Verify Deployment

1. Check the deployment URL
2. Test the homepage: `https://your-project.vercel.app`
3. Test attendance entry: `https://your-project.vercel.app/entry`
4. Test admin login: `https://your-project.vercel.app/admin/login`

## Manual Deployment via CLI

If website deployment fails, try via CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (will prompt for settings)
vercel

# For production
vercel --prod
```

## Force New Deployment

If deployment seems stuck:

1. Delete the project in Vercel (Settings → Delete Project)
2. Re-import from GitHub
3. Add all environment variables again
4. Deploy

## Still Having Issues?

1. Check Vercel Status: https://www.vercel-status.com
2. Check your GitHub repository is public (or connect your GitHub account properly for private repos)
3. Ensure Node.js version is 18+ (Vercel uses 18.x by default)
4. Check build logs for specific errors

## Quick Checklist

- [ ] All environment variables added in Vercel
- [ ] MONGODB_URI is correctly formatted
- [ ] MongoDB network access configured (for Atlas)
- [ ] GitHub repository is connected
- [ ] Build completes without errors
- [ ] Deployment URL is accessible
- [ ] Test attendance submission works
- [ ] Test admin dashboard works




