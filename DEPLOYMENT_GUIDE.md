# Deployment Guide

This guide explains how to host your Church Attendance System application.

## Why Not Static Hosting?

**Static hosting (like GitHub Pages, Netlify Static, etc.) will NOT work** because this app requires:
- Server-side API routes (attendance, authentication)
- Server-side Google Sheets API integration
- Environment variables for secure credential storage
- Session management for authentication

## Recommended: Vercel (Free & Easy)

Vercel is the company behind Next.js and provides the best hosting experience.

### Step 1: Prepare Your Code

1. Make sure your code is pushed to a Git repository (GitHub, GitLab, or Bitbucket)

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up/Login (can use GitHub account)
3. Click **"Add New Project"**
4. Import your Git repository
5. Vercel will auto-detect it's a Next.js app

### Step 3: Configure Environment Variables

In the Vercel project settings, add these environment variables:

```
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=arc-attendance@cobalt-mind-471613-p5.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDgHuFY0qM9DFOR\nr5A/xTTGlhoDFDb4Pvr5xxGEc6N6ARbkBm58aRzjN1E5O1PoaqeL6NywHDj0//SW\nnHaaHYZ7+uK+a94QeGeHjgSIlHgpmnFbBoqXYnw87SvZQ9frX0wotV23kEEUL9Bw\nf3qvSf/4qj/4/zSn6eqnjJItT2qS91xoFZh7WfO+uWO7kATY7F+Oc9gTt/hUSyoc\nAnlP1J29uub2nkU4uVbbbkbzyB5LT985oVud82eYNPBeDvHsm1/QKqQEa+cpQt1H\naVdpA3snXAvMq9lqK6Gyvrwf9/dVRxB4fcSY+sJ4EzI4lEmDJ6fgK9BIU50Hg3tA\nrpAyky+fAgMBAAECggEAGgFrS4exelF2VvbEqamj3JEpNoc/c6G3NIl1TmWup+b9\ndXsLkfMOb40JJzdrnpHVnCXqiaLUtxUGF/3Sw0I+yx8K9WaFz2pxNOj1PLXhlY4+\nrf290iAS42zvxBebs8uMhkK5O6YI7yM3L/6SyUkwYvW6U5WlUgCSAlwM0CYhaykC\nBynLBudb1z9KMO84tleMMB3aNCfKhJNph06y/flepe5SG4XM+4B78d1g0xnj3+AX\nE38GDE6izx1V6hA+FiWDRFENL9zkngkRoMPczxLLJeod7R1GuUJGkSkhWqA6TMMD\n8p00R4MhVraWjZXIUvUYefBn6S2sDsImfd64c9SU/QKBgQD+X4mTSDR15OLss8zr\nsjTOfB/Fazv5LnTh8vYjssgVEKws4WnYUDf2GHTc04ui4DCLnAcYlPNPH3c++sUz\n1cWP0uZoqhOJ7q2Hd0+DRippJAxqV/XFjIZALM/mW/ELTLR3YLchrMyom4VlIWqP\nUzbV5WdVvGCwqdlUnsRnM+zEjQKBgQDhjdAiMeebwhD+DNktVLGXG9qikppONnyD\nN4hxzS08EBUBBMvqHMDjLp8rzBXNe6cYplXJh5a0pgxZOXjEOEb+ow1o0cQ5pepm\nOtV0Oo+bgfbHeM+8ODyStXXUCkxoVtTb7c7r4fL9119AVZUEtj8+T16qiEKICCZ/\nkqQLHa/32wKBgQCHjIt4M3LZHAYckldxhb4EBjq77b/AshPQz7KAJWXfa8oEBH5t\nqZmYh0HG5uey/HqB+rwBSmY5VJArvF/XlmO3l2/2eCL/TnOkC10QnBQ/gNko1gR+\np7pmejqzC21wUwib0Krlw/ovIui7kkoBZBuFccBV/JMdsPTB1fTc9duGhQKBgQCq\nKTSWN5QFm/j50HOfkT+RQoBFGdiznMN+ssyLHkE8CN3vsNCtxBd4zNlkT0k7hkff\nfs1FhrcZfhPe1E7ZqaNVw2kAZRBmdVdK3KPgVbW1mey1O91sn/iCrcdAuqw+IxPe\n/5+VsRaCjpLblDUiIuO/fF1sxfN7cLqqj9SWVkVE9QKBgQC+G3p+Y2JvM8bbW1kT\ngX9mof6P6XFjDzWARraAtQ3Opz+34iSGNf58HiRuo9kuOyz7iUUDghWQhva82Pd8\nmac5b5T8+h84W1aG/+LC0L9WOTlX5O3TRoTW6lPLcYX8gPCzQLtLcY/13aO8qg1V\nTO9Jq3NF+IBWOotnG+ve6Pi/tw==\n-----END PRIVATE KEY-----\n"
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
ADMIN_SESSION_SECRET=generate_a_random_string_here
```

**Important**: Copy the exact values from your `.env.local` file.

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. Your app will be live at `https://your-project-name.vercel.app`

### Step 5: Custom Domain (Optional)

- In project settings, add your custom domain
- Follow Vercel's DNS configuration instructions

---

## Alternative: Netlify

Netlify also supports Next.js with serverless functions.

1. Go to [netlify.com](https://netlify.com)
2. Connect your Git repository
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
4. Add environment variables (same as Vercel)
5. Deploy

---

## Alternative: Self-Hosted (VPS/Server)

If you have your own server:

### Using PM2 (Recommended)

```bash
# Install dependencies
npm install

# Build the app
npm run build

# Install PM2 globally
npm install -g pm2

# Start the app with PM2
pm2 start npm --name "attendance-app" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Then:
```bash
docker build -t attendance-app .
docker run -p 3000:3000 --env-file .env.local attendance-app
```

---

## Environment Variables Checklist

Make sure these are set in your hosting platform:

- ✅ `GOOGLE_SHEETS_SPREADSHEET_ID`
- ✅ `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- ✅ `GOOGLE_PRIVATE_KEY` (keep the quotes and `\n` characters)
- ✅ `ADMIN_USERNAME`
- ✅ `ADMIN_PASSWORD`
- ✅ `ADMIN_SESSION_SECRET`

---

## Security Notes

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Use strong passwords** for admin credentials
3. **Rotate secrets periodically**
4. **Enable HTTPS** (automatic on Vercel/Netlify)
5. **Keep dependencies updated**

---

## Troubleshooting

### Build Fails
- Check that all environment variables are set
- Verify Node.js version (18+)
- Check build logs for specific errors

### API Routes Not Working
- Ensure environment variables are set correctly
- Check that Google Sheets credentials are valid
- Verify the Google Sheet is shared with service account

### Google Sheets Access Issues
- Double-check service account email is correct
- Verify sheet is shared with Editor permissions
- Check spreadsheet ID is correct

---

## Quick Start: Vercel CLI

You can also deploy from command line:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Set environment variables
vercel env add GOOGLE_SHEETS_SPREADSHEET_ID
vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL
vercel env add GOOGLE_PRIVATE_KEY
# ... etc
```

This will give you a production URL like: `https://your-app.vercel.app`

