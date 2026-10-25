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

## Fellowship leaders and member care

Apply the Supabase migrations in order, including
`supabase/migrations/202610180001_fellowship_structure.sql` and
`supabase/migrations/202610180002_role_account_management.sql`, before deploying this
workspace. The server needs `SUPABASE_SERVICE_ROLE_KEY` for roster writes and
member management. The migration removes direct roster writes from public
Supabase clients; public attendance continues through the server API.

The environment login named by `ADMIN_USERNAME` is the base administrator. Sign
in with that account and open **Users & Roles → Fellowship Leader → Create accounts from the fellowship leader roster** to
select active roster members designated **Fellowship Leader**, review their
fellowships, and create their logins. New credentials can be downloaded once in
that browser session. Repeating setup skips linked accounts without resetting
their passwords. The base administrator can also add future leaders manually
and reset passwords. Other administrators cannot create or modify fellowship
leader accounts.

Users & Roles groups managed and configured staff accounts inside each role’s
accordion. Account editors can change usernames, passwords, role assignments
and active status. The base administrator can edit built-in role permissions;
administrator roles retain Users & Roles access, and fellowship leaders retain
their fellowship roster scope. Custom roles remain editable by administrators.
Permissions apply to every account in the role immediately.

The base administrator can save an existing configured staff login into managed
accounts. Its old environment identity is then retired, including after a rename
or deactivation; authentication never falls back to those credentials. The base
administrator can update its own credentials in My profile while
retaining its immutable base identity and full privileges. Its original configured
credentials are retired after its first profile save. The service
role key is required for staff authentication. Username changes and
password resets revoke existing managed sessions.

Fellowship leaders land on **Member Roster**, scoped to their assigned fellowship.
They can edit personal details, add/import/archive brethren, and open the
**Care Centre** to review fellowship care suggestions and manage their own
follow-ups. Care endpoints derive the fellowship from the verified session;
leaders cannot view another fellowship or assign tasks to another account.
Cell/BSCT setup, assignment controls and roster columns have been removed.
Existing structure/history is retained, and existing designations are preserved
when editing personal details. Public Mark Attendance remains open.

Validation: `node --import tsx --test tests/**/*.test.ts`, `npm run lint`, and
`npx tsc --noEmit --incremental false`. The transactional PostgreSQL checks in
`tests/fellowship-structure.sql` run against a disposable database after applying
the migrations and roll back their fixtures.

## Member duplicate review

Member duplicate review uses normalized phone-number matches. Ghana local,
nine-digit and `+233`/`00233` formats use the same identifier; international
country codes remain distinct. If either number is missing or invalid, matching
full names (including reversed name order), fellowship, and birthday or location
suggest a review. Two different valid numbers remain separate identities.
Apply `supabase/migrations/20261025111249_review_archived_duplicates.sql` to include
unmerged archived copies in reviewed merges into an active primary. The original
archive state and attendance history are preserved in the merge audit. All merges
require an explicit decision, and saved keep-separate decisions remain in effect.
Raw Data's duplicate removal handles attendance rows, separately from this roster review.

Apply `supabase/migrations/20261025112600_preserve_distinct_member_attendance.sql`
to protect attendance evidence during merges. Linked attendance from both members
is retained under the primary. Each distinct service attended counts once;
present wins over overlapping absent evidence. For the same eight-service window,
3/8 plus 5/8 becomes 8/8 when there are no overlapping services. Stored rows,
dates, statuses and first-visit evidence are checked before the merge commits.
Unlinked history requires a matching reviewed name and fellowship, without a
conflicting phone or another roster owner. A shared phone alone cannot claim
another person's attendance. Ambiguous history stays unlinked for review.

Raw Data's **Check Attendance Overlaps** action is read-only. It reports logical
consolidation without deleting source rows; the legacy cleanup URL also follows
this behavior. Deleting the oldest/newest duplicate can discard present evidence,
so permanent attendance cleanup is no longer available through that action.

Apply `supabase/migrations/20261020011702_prevent_duplicate_member_phones.sql` to
block conflicting phone saves globally across active members. Creates, edits,
reactivation and imports use the same normalized key, with database enforcement
for simultaneous submissions. Existing duplicates remain available for review;
their next edit must resolve the phone conflict, or they can be removed/merged.
Also apply `supabase/migrations/20261020012022_preserve_partial_phone_duplicate_merges.sql`
so approved partial merges can reduce existing duplicate groups atomically. Blank or malformed numbers stay outside
phone matching. Imports now insert the whole file atomically: a conflicting row
rejects the import without updating existing members or saving part of the file.
The rollback-only SQL check is `tests/member-phone-unique.sql`; run
`tests/member-phone-concurrency.mjs` with explicit disposable `PGHOST`, `PGPORT`
and `PGDATABASE` settings to verify simultaneous saves.
`tests/member-phone-legacy-merges.mjs` verifies reviewed partial merges and
continued blocking of ordinary duplicate saves in separate transactions.

## Member roster attendance colors

The admin and fellowship **Member Roster** colors show recorded attendance in the
same last eight church service dates: **green** for 4–8 services, **yellow** for
1–3, and **red** for zero. A row badge also shows the count and text label.
Repeated attendance entries count once per member/service; future dates and
invalid records are excluded. Archived members stay gray and excluded. If fewer
than eight services exist, the displayed denominator is the available count;
no service data or a failed attendance load stays neutral. **Refresh attendance**
reloads the roster and colors. The authenticated summary endpoint scopes member
details to the leader's fellowship; only service dates are shared across scopes.
The default roster order is attendance descending: green, yellow, red, then gray.
Within the colored groups, higher attendance comes first and names break ties.
Click a data column header to sort it; click again to reverse direction. Birthdays
sort by calendar month/day, phone formats are normalized for comparison, and
missing values stay last. **Reset to color order** restores the default.
Color pills filter alongside search, fellowship, designation and archive status;
click the selected color again or **All colors** to clear the color filter.
The same service window and thresholds also appear in **Overview** (active-member
color totals and member care/birthday cards), **Absenteeism**, and **Fellowship
Attendance History**. Absenteeism and history rows show the same count badges,
start in color order, and support color filtering. Report date/month filters
change their historical metrics without changing the latest-eight-service color.
Existing report permissions still apply; absenteeism-only staff can read active
attendance colors without gaining roster editing or archived-member access.

## Account emails and fellowship birthday reminders

Apply the account email migration and
`supabase/migrations/20261018140319_staff_self_service_email.sql` before deploying
self-service account settings. Every signed-in staff member can open **My profile**
from the sidebar or top navigation and change their own username, email and
password by confirming their current password. Password changes require matching
confirmation and at least 12 characters (at most 72 UTF-8 bytes). The base
administrator can use this too, retaining full privileges after a rename.
Other administrators cannot edit the base administrator account.

Fellowship leaders also see **Upcoming birthdays** above the member roster on
their homepage and above their profile settings:
today and the next 60 days, ordered soonest first. The server uses the verified
account's fellowship and active members only, ignores caller-supplied fellowship
filters, and returns names, birthday timing and saved phone numbers for call
actions. This list works independently of SMS delivery configuration.

The fellowship leader sidebar includes **Birthdays** (the full active fellowship
list, with name search, month filters and missing birthday details) and
**Fellowship Attendance History** (service graph, exact counts and expandable individual
service dates). Attendance can be filtered by dates or member; archived brethren
are excluded from attendance views, data exports and calculations. Only explicitly recorded absences count as absent;
overlaps count once per person/service, with present evidence taking precedence.
Legacy attendance is linked only when a member can be identified unambiguously.
Leaders use their existing Member Roster permission and remain restricted to
their assigned fellowship. Staff with **By Fellowship** reporting access also see
**Fellowship Attendance History**, with a fellowship selector.

**Member Roster** defaults to **All brethren**, including clearly labelled
archived brethren. Every active row has an **Archive** action, and archived rows
have **Unarchive**. Actions stay visible when the table scrolls horizontally.
Archiving retains stored history but excludes the person from attendance records,
calculations, active check-in, birthday lists and cell/BSCT assignments.
Unarchiving returns them to active views and calculations; cell and BSCT assignments
must be made again. The confirmed saved status updates the roster immediately,
so restored records leave **Archived brethren** and appear in **Active brethren**.
Repeated requests reconcile the saved status, and blocked restores show their
reason beside the affected row. Previously removed (soft-deleted) records appear in the roster,
while records retired by approved duplicate merges do not.
Restore rejects a phone number already held by another active member. Duplicate
phone messages name the existing member when that record is within the staff
account's permitted roster; names outside a leader's fellowship remain private.

Apply `supabase/migrations/20261020015946_restore_archived_members_on_present_attendance.sql`
for automatic restoration. Recording an archived member **present** (including a
correction from absent to present) returns the same identity to the active roster
and keeps their history. Absent entries, future services and merged-away members
do not reactivate them. Cell and BSCT assignments still need to be made again.
The attendance write and restoration commit together, and a conflicting active
phone number rolls both back. Public check-in recognizes a returning archived
member by their full name and fellowship with no conflicting known phone, rather
than treating them as a first-time visitor. Existing historical attendance is not
backfilled by this migration.

Apply `supabase/migrations/20261020021249_fellowship_sunday_projections.sql`
for **Sunday Projections**. Fellowship leaders select active brethren expected
for a chosen Sunday and save their forecast. They can edit it until **9 a.m.
on that Sunday in Africa/Accra**, including while attendance is being recorded.
The database checks the cutoff at save time. Concurrent edits use revisions so
one leader cannot silently overwrite another's forecast.

The comparison distinguishes projected attendees who came, projected attendees
without a present record, and unprojected arrivals (including visitors). Missing
attendance is not automatically marked absent. Leaders can add expected first-time visitors
by name and optional phone number in the projection section. These visitors count
in both leader and pastor projections without creating roster records. A unique
normalized phone or unambiguous full-name match links recorded arrivals; uncertain
matches stay separate. Apply
`supabase/migrations/20261020025647_projection_guests_and_9am_cutoff.sql` for visitor
storage and the database-enforced 9 a.m. cutoff. Missing projections remain
**Not submitted**, distinct from an explicitly saved zero forecast. Archived
brethren are excluded from both forecast and actual counts while archived;
unarchiving restores their inclusion. Administrators and pastors with Overview
or By Fellowship access see the all-fellowship graph, counts and expandable names;
only fellowship leaders can save their own fellowship's projection.

Projection SQL checks and concurrency tests run only against a disposable database:
`tests/sunday-projections.sql` and `tests/projection-concurrency.mjs`.

Staff can sign in with their saved email or username and the same password.
Emails are normalized and unique across managed and configured accounts.
**Users & Roles → Edit account** remains available for administrators. An email
is optional when creating any account, including fellowship leaders. SMS reminders
use saved account phone numbers and the profile reminder preference. Managed email,
username and password changes revoke other sessions while keeping the device
saving its profile signed in.

Apply `supabase/migrations/20261018163411_preserve_profile_followup_ownership.sql`
to preserve follow-up assignments atomically when a managed or configured account
changes username. Historical audit entries keep the names recorded at the time.

## Administrator bulk SMS

Apply `supabase/migrations/20261020131331_bulk_sms_campaigns.sql`. Administrators
can open **Bulk SMS** in the sidebar, choose one fellowship or the entire church,
and preview the message, unique recipients and estimated SMS parts before sending.
It uses the existing SMSOnlineGH API key and approved sender from Users & Roles.
Only active, unmerged roster members with valid contacts are included; normalized
shared numbers receive one message. GSM extensions and Unicode are counted when
estimating message parts. Final charges depend on the provider plan and destination.

Previews expire after 15 minutes and must be recreated if the audience or sender
changes. Submissions use durable claims in batches of 250. Completed batches are
never replayed. If a page closes between batches, an administrator can continue
the remaining recipients from message history. Newly archived or changed contacts
are skipped. Interrupted or uncertain provider submissions require manual review
in SMSOnlineGH before another message is created; acceptance is not a delivery receipt.
The service-only history records the audience, message, administrator and outcomes.

**Check balance** reads the provider account balance. **Buy SMS credits** opens
the [SMSOnlineGH account portal](https://portal.smsonlinegh.com/auth/login) in a new
tab; top up the account whose API key is connected here, then refresh the balance.
An embedded payment checkout is not configured. The provider's published API
documents sending and balance checks, but no credit-purchase endpoint was found.

## SMS birthday reminders and Google Drive photos

Apply `supabase/migrations/20261020023921_staff_photos_sms_and_integrations.sql`
before deploying these features. New integration credentials, photo links and SMS
claims use private tables with RLS and service-role-only access. Staff phone
numbers are optional and normalized to international format in **My profile**.

Birthday email sending has been replaced with **SMSOnlineGH**. The daily cron
runs at **08:00 Africa/Accra**, seven days and one day before birthdays. Active
fellowship leaders receive their fellowship's reminders; active administrators
receive reminders across all fellowships. Accounts need a saved phone number and
an enabled birthday SMS preference. Normalized duplicate recipients receive one
message per birthday/timing. Persisted claims prevent concurrent duplicate sends;
provider acceptance is recorded separately from handset delivery. Ambiguous
network outcomes are retained as `uncertain` for review rather than resent.

The same daily job sends a birthday greeting directly to each active, unmerged
member's valid roster phone number **on their birthday at 08:00 Africa/Accra**,
always from **CEYC ARC**. Archived members, missing/invalid phone numbers and
invalid birthdays are excluded. Greetings do not depend on staff phone numbers
or staff reminder preferences. Normalized shared phone numbers receive one
greeting per birthday date, including across reruns and concurrent requests.
The greeting has a separate persisted claim from leader reminders. Register
**CEYC ARC** as an approved sender in SMSOnlineGH; the app cannot register or
approve a provider sender automatically. No catch-up greetings are sent for
past birthdays. A saved sender (default **CEYC ARC**) still controls leader reminders.

The base administrator opens **Users & Roles → SMS & Google Drive setup**, saves
the SMSOnlineGH API key and approved sender, and saves Google web OAuth client
credentials. The API key and OAuth secrets are encrypted at rest with AES-GCM
using a key derived from `ADMIN_SESSION_SECRET`; keep that secret stable or
re-enter integration credentials when rotating it. Environment settings
`SMSONLINEGH_API_KEY`/`SMSONLINEGH_SENDER` and `GOOGLE_DRIVE_CLIENT_ID`,
`GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, and
`GOOGLE_DRIVE_PHOTO_FOLDER_ID` are optional alternatives. Secrets are never returned
to the browser. `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` remain required.

Enable the Google Drive API in the Google Cloud project, create a **Web application**
OAuth client and register the redirect URI displayed in setup. Select
**Connect Google Drive** and authorize the Google account that will own the photos.
The app requests `drive.file` access and creates a private **ARC Attendance Photos**
folder. Photos never require public sharing. This connection is for the deployed
website and is separate from any Google Drive connection in Codex.

All staff profiles and existing-member editors contain a picture upload section.
JPG, PNG and WebP files are limited to 2 MB and checked by file signature.
The signed-in account or permitted fellowship is checked on uploads and every
image read; Drive file IDs and credentials are not exposed by public roster reads.
Configured-account picture identity survives profile conversion and renaming.
Replacing a photo retains the previous file in Drive rather than deleting it.

Tests use simulated SMS/Google responses and disposable local database records;
no real messages or personal photos are sent during verification.
