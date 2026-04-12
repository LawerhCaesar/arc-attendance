# Church Attendance Web App

A Next.js full-stack application for recording and tracking Sunday service attendance with MongoDB database integration and an admin dashboard for analytics.

## Features

- **Public Entry Form**: Record attendance with name, phone, location, birthday, and fellowship
- **MongoDB Database**: Scalable NoSQL database for storing attendance records
- **Admin Dashboard**: Protected admin area with comprehensive analytics
- **Analytics & Charts**: 
  - Total attendance statistics
  - Weekly and monthly trends
  - Demographics breakdown (location and age distribution)
  - Repeat visitors analysis
- **Authentication**: Secure admin login system

## Prerequisites

- Node.js 18+ and npm
- MongoDB database (local or MongoDB Atlas cloud)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. MongoDB Setup

See [MONGODB_SETUP.md](./MONGODB_SETUP.md) for detailed MongoDB setup instructions.

**Quick Start:**
- **Option 1 (Recommended)**: Use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free cloud database)
- **Option 2**: Install MongoDB locally on your machine

### 3. Environment Variables

Create a `.env.local` file in the project root:

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/attendance_db?retryWrites=true&w=majority
MONGODB_DB_NAME=attendance_db

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
ADMIN_SESSION_SECRET=your_random_session_secret_here

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important Notes:**
- Replace `MONGODB_URI` with your actual MongoDB connection string
- For local MongoDB, use: `mongodb://localhost:27017/attendance_db`
- Generate a secure random string for `ADMIN_SESSION_SECRET`
- Change `ADMIN_PASSWORD` to a secure password
- The database will be created automatically on first connection

### 4. Initialize Database Indexes (Optional but Recommended)

Run this once to create indexes for better query performance:

```bash
npx tsx scripts/init-db.ts
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Recording Attendance

1. Navigate to `/entry` or use the "Mark Attendance" link
2. Fill in the form with:
   - Name
   - Phone number
   - Location
   - Birthday
   - Fellowship
   - First timer status
3. Click "Submit Attendance"
4. Data is automatically saved to your MongoDB database

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

## Database Schema

The attendance records are stored in MongoDB with the following structure:

```typescript
{
  date: string;              // Date in YYYY-MM-DD format
  name: string;              // Attendee name
  phone: string;             // Phone number
  location: string;          // Location/address
  birthday: string;          // Birthday date
  fellowship: string;        // Fellowship group
  firstTimer: string;        // "Yes" or "No"
  attendanceDate?: string;   // Optional attendance date
  attendanceStatus?: string; // Optional status
  createdAt: Date;           // Automatic timestamp
}
```

## Security Notes

- Change default admin credentials before deploying
- Use environment variables for all sensitive data
- Consider using a proper session store (Redis, database) for production
- Enable HTTPS in production
- Secure your MongoDB connection (use MongoDB Atlas IP whitelist for production)
- Regularly rotate your admin passwords

## License

MIT

