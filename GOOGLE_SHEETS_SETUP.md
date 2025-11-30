# Google Sheets Setup Guide

This guide will walk you through setting up Google Sheets as your database for the Attendance System.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click on the project dropdown at the top
4. Click **"New Project"**
5. Enter a project name (e.g., "Church Attendance")
6. Click **"Create"**

## Step 2: Enable Google Sheets API

1. In your Google Cloud project, go to **"APIs & Services" > "Library"**
2. Search for **"Google Sheets API"**
3. Click on it and click **"Enable"**
4. Wait for it to enable (usually takes a few seconds)

## Step 3: Create a Service Account

1. Go to **"IAM & Admin" > "Service Accounts"**
2. Click **"Create Service Account"**
3. Fill in:
   - **Service account name**: `attendance-service` (or any name you prefer)
   - **Service account ID**: Will auto-fill
   - **Description**: "Service account for attendance system"
4. Click **"Create and Continue"**
5. Skip the optional steps and click **"Done"**

## Step 4: Create and Download Service Account Key

1. Click on the service account you just created
2. Go to the **"Keys"** tab
3. Click **"Add Key" > "Create new key"**
4. Select **JSON** format
5. Click **"Create"**
6. A JSON file will download automatically - **SAVE THIS FILE SECURELY**

The JSON file will look like this:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "attendance-service@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

## Step 5: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click **"Blank"** to create a new spreadsheet
3. Name it (e.g., "Church Attendance")
4. Copy the **Spreadsheet ID** from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`
   - Copy the part between `/d/` and `/edit`
   - Example: If URL is `https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit`, 
     then ID is `1a2b3c4d5e6f7g8h9i0j`

## Step 6: Share Sheet with Service Account

1. In your Google Sheet, click the **"Share"** button (top right)
2. In the "Add people and groups" field, paste the **service account email**:
   - Found in the JSON file as `client_email`
   - Format: `something@your-project.iam.gserviceaccount.com`
3. Make sure the permission is set to **"Editor"**
4. **Uncheck** "Notify people" (service accounts don't have email)
5. Click **"Share"**

## Step 7: Set Up Environment Variables

1. Create a `.env.local` file in your project root (if it doesn't exist)
2. Add the following variables:

```env
# Google Sheets Configuration
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
ADMIN_SESSION_SECRET=generate_a_random_string_here

# Next.js (optional for local development)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### How to Extract Values from JSON:

1. **GOOGLE_SHEETS_SPREADSHEET_ID**: Copy from Step 5
2. **GOOGLE_SERVICE_ACCOUNT_EMAIL**: Copy the `client_email` value from the JSON file
3. **GOOGLE_PRIVATE_KEY**: Copy the `private_key` value from the JSON file
   - **Important**: Keep the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
   - Keep the `\n` characters (they represent newlines)
   - Wrap the entire key in double quotes

### Example `.env.local` file:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=1a2b3c4d5e6f7g8h9i0j
GOOGLE_SERVICE_ACCOUNT_EMAIL=attendance-service@my-project-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MySecurePassword123!
ADMIN_SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

## Step 8: Generate ADMIN_SESSION_SECRET

You can generate a random secret using:
- Online generator: https://randomkeygen.com/
- Or run in terminal: `openssl rand -base64 32`
- Or use Node.js: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

## Step 9: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to `http://localhost:3000/entry`
3. Fill in the attendance form and submit
4. Check your Google Sheet - you should see the data appear!

## Troubleshooting

### Error: "Google Sheets credentials not configured"
- Make sure `.env.local` file exists in the project root
- Check that all three Google Sheets variables are set
- Restart your development server after adding environment variables

### Error: "The caller does not have permission"
- Make sure you shared the Google Sheet with the service account email
- Verify the service account email matches exactly (copy-paste it)
- Make sure the permission is set to "Editor"

### Error: "Spreadsheet ID not configured"
- Check that `GOOGLE_SHEETS_SPREADSHEET_ID` is set correctly
- The ID is the part between `/d/` and `/edit` in the URL

### Private Key Issues
- Make sure the private key includes the BEGIN and END lines
- Keep the `\n` characters (they're important!)
- Wrap the entire key in double quotes
- If using Windows, you might need to escape quotes differently

## Security Best Practices

1. **Never commit `.env.local` to git** - it's already in `.gitignore`
2. **Keep your service account JSON file secure** - don't share it publicly
3. **Use strong passwords** for admin credentials
4. **Rotate keys periodically** - create new service account keys every 6-12 months
5. **Limit service account permissions** - only give Editor access to the specific sheet needed

## Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Check the terminal/server logs
3. Verify all environment variables are set correctly
4. Make sure the Google Sheet is shared with the service account


