# Church Attendance Web App

A Next.js full-stack application for recording and tracking Sunday service attendance with direct Google Sheets integration and an admin dashboard for analytics.

## Features

- **Public Entry Form**: Record attendance with name, phone, email, location, and birthday
- **Google Sheets Integration**: Direct data entry into Google Sheets
- **Admin Dashboard**: Protected admin area with comprehensive analytics
- **Analytics & Charts**: 
  - Total attendance statistics
  - Weekly and monthly trends
  - Demographics breakdown (location and age distribution)
  - Repeat visitors analysis
- **Authentication**: Secure admin login system

## Prerequisites

- Node.js 18+ and npm
- Google Cloud Project with Sheets API enabled
- Google Service Account credentials

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Sheets API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API
4. Create a Service Account:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Give it a name and create
   - Click on the service account, go to "Keys" tab
   - Click "Add Key" > "Create new key" > JSON
   - Save the JSON file securely

5. Create a Google Sheet:
   - Create a new Google Sheet
   - Share it with the service account email (found in the JSON file)
   - Copy the Spreadsheet ID from the URL (between `/d/` and `/edit`)

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Google Sheets API Configuration
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
ADMIN_SESSION_SECRET=your_random_session_secret_here

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important Notes:**
- Extract the `private_key` from your service account JSON file
- Keep the `\n` characters in the private key
- Generate a secure random string for `ADMIN_SESSION_SECRET`
- Change `ADMIN_PASSWORD` to a secure password

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Recording Attendance

1. Navigate to `/entry` or use the "Record Attendance" link
2. Fill in the form with:
   - Name
   - Phone number
   - Email address
   - Location
   - Birthday
3. Click "Submit Attendance"
4. Data is automatically saved to your Google Sheet

### Admin Dashboard

1. Navigate to `/admin/login`
2. Enter your admin credentials
3. View analytics including:
   - Summary statistics
   - Attendance trends (weekly/monthly)
   - Demographics charts
   - Repeat visitors table

## Project Structure

```
├── app/
│   ├── admin/          # Admin dashboard pages
│   ├── api/            # API routes
│   ├── entry/          # Public entry form
│   └── page.tsx        # Home page
├── components/         # React components
├── lib/                # Utility functions
└── middleware.ts       # Route protection
```

## API Routes

- `POST /api/attendance` - Record attendance
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/check` - Check authentication status
- `GET /api/analytics/summary` - Get summary statistics
- `GET /api/analytics/trends` - Get attendance trends
- `GET /api/analytics/demographics` - Get demographics data
- `GET /api/analytics/repeat-visitors` - Get repeat visitors analysis

## Building for Production

```bash
npm run build
npm start
```

## Security Notes

- Change default admin credentials before deploying
- Use environment variables for all sensitive data
- Consider using a proper session store (Redis, database) for production
- Enable HTTPS in production
- Regularly rotate your Google Service Account keys

## License

MIT

