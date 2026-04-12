# Deployment Guide

This guide explains how to host your Church Attendance System application.

## Why Not Static Hosting?

**Static hosting (like GitHub Pages, Netlify Static, etc.) will NOT work** because this app requires:
- Server-side API routes (attendance, authentication)
- MongoDB database connection
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
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/attendance_db?retryWrites=true&w=majority
MONGODB_DB_NAME=attendance_db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
ADMIN_SESSION_SECRET=generate_a_random_string_here
NEXT_PUBLIC_APP_URL=https://your-project-name.vercel.app
```

**Important**: 
- Replace `MONGODB_URI` with your actual MongoDB Atlas connection string
- For local MongoDB: `mongodb://localhost:27017/attendance_db`
- Copy the exact values from your `.env.local` file

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

- ✅ `MONGODB_URI` (your MongoDB connection string)
- ✅ `MONGODB_DB_NAME` (database name, e.g., `attendance_db`)
- ✅ `ADMIN_USERNAME`
- ✅ `ADMIN_PASSWORD`
- ✅ `ADMIN_SESSION_SECRET`
- ✅ `NEXT_PUBLIC_APP_URL` (your deployment URL)

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
- Check that MongoDB connection string is valid
- Verify MongoDB network access is configured (for Atlas)
- Check MongoDB service is running (for local)

### MongoDB Connection Issues
- Verify MongoDB URI format is correct
- Check MongoDB Atlas network access allows connections (0.0.0.0/0 for all)
- Ensure username and password in connection string are correct
- For local MongoDB, verify the service is running and accessible

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
vercel env add MONGODB_URI
vercel env add MONGODB_DB_NAME
vercel env add ADMIN_USERNAME
vercel env add ADMIN_PASSWORD
vercel env add ADMIN_SESSION_SECRET
vercel env add NEXT_PUBLIC_APP_URL
```

This will give you a production URL like: `https://your-app.vercel.app`




