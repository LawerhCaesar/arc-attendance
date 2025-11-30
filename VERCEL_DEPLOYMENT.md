# Vercel Deployment Guide

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Repository name: `arc-attendance` (or any name you prefer)
4. Description: "Church Attendance System"
5. Choose **Public** or **Private**
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click **"Create repository"**

## Step 2: Push Code to GitHub

After creating the repository, GitHub will show you commands. Run these in your terminal:

```bash
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/arc-attendance.git

# Rename branch to main (if needed)
git branch -M main

# Push your code
git push -u origin main
```

**If you get authentication errors**, you may need to:
- Use a Personal Access Token instead of password
- Or set up SSH keys
- Or use GitHub Desktop

## Step 3: Deploy to Vercel

### Option A: Via Vercel Website (Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Sign up/Login (can use GitHub account - recommended!)
3. Click **"Add New Project"**
4. Import your GitHub repository (`arc-attendance`)
5. Vercel will auto-detect Next.js settings

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from your project directory)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? arc-attendance
# - Directory? ./
# - Override settings? No
```

## Step 4: Configure Environment Variables in Vercel

**CRITICAL**: You must add all environment variables in Vercel!

1. Go to your project in Vercel dashboard
2. Click **"Settings"** → **"Environment Variables"**
3. Add each variable:

```
GOOGLE_SHEETS_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
NEXT_PUBLIC_APP_URL
```

4. Copy values from your `.env.local` file
5. **Important for GOOGLE_PRIVATE_KEY**: 
   - Keep the quotes
   - Keep the `\n` characters
   - Paste the entire key including BEGIN/END lines

6. Click **"Save"** for each variable

## Step 5: Redeploy

After adding environment variables:

1. Go to **"Deployments"** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger automatic deployment

## Step 6: Custom Domain (Optional)

If you have a custom domain (like `arcattendance.atrausx-r.com`):

1. Go to **"Settings"** → **"Domains"**
2. Add your domain: `arcattendance.atrausx-r.com`
3. Follow Vercel's DNS configuration instructions
4. Update `NEXT_PUBLIC_APP_URL` environment variable to your domain

## Automatic Deployments

Once connected:
- Every push to `main` branch = automatic deployment
- Preview deployments for pull requests
- Zero-downtime deployments

## Troubleshooting

### Build Fails
- Check environment variables are all set
- Check build logs in Vercel dashboard
- Verify Node.js version (Vercel uses 18.x by default)

### API Routes Not Working
- Ensure all environment variables are set
- Check that Google Sheets credentials are correct
- Verify the Google Sheet is shared with service account

### Environment Variables Not Working
- Make sure you added them in Vercel dashboard (not just locally)
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

## Quick Commands Reference

```bash
# Check git status
git status

# Add all changes
git add .

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push

# Deploy to Vercel (if using CLI)
vercel --prod
```

## Next Steps After Deployment

1. Test your live site
2. Verify Google Sheets integration works
3. Test attendance submission
4. Test admin login
5. Set up custom domain if needed

Your app will be live at: `https://your-project-name.vercel.app`

