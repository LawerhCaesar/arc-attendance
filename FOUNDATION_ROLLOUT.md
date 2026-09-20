# Pastoral dashboard foundation

The new foundation is intentionally additive. The existing `members` and
`attendance` tables continue to power the application until their data has been
reviewed and backfilled into the normalized tables.

## 1. Authentication configuration

Existing `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`
variables continue to work. The legacy account receives the `admin` role unless
`ADMIN_ROLE` is set to `pastor`, `attendance`, `fellowship_leader`,
`welfare`, or `first_timers`.

Multiple staff accounts can be configured with `APP_USERS_JSON`. Passwords may
be bcrypt hashes and should never be committed to source control.

```json
[
  { "username": "pastor", "password": "$2b$...", "role": "pastor" },
  { "username": "attendance", "password": "$2b$...", "role": "attendance" },
  { "username": "welfare", "password": "$2b$...", "role": "welfare" },
  { "username": "first-timers", "password": "$2b$...", "role": "first_timers" },
  { "username": "cell-leader", "password": "$2b$...", "role": "fellowship_leader", "fellowship": "Pleroma" }
]
```

`ADMIN_SESSION_SECRET` is mandatory in production. Changing it signs out all
existing sessions.

## 2. Database migration

Apply `supabase/migrations/202609090001_pastoral_foundation.sql` through the
Supabase CLI or SQL editor. It creates normalized people, service, attendance,
visitor journey, care task, interaction, profile, and audit tables with RLS.

Then apply `supabase/migrations/202609090002_department_access.sql`. It adds
the Welfare and First Timers roles, their scoped policies, and durable email
delivery history.

Finally apply `supabase/migrations/202609090003_member_duplicate_review.sql`.
It creates the admin duplicate-decision queue and a service-role-only,
transactional soft-merge function. Possible matches are suggested when names
are similar and either contact numbers or fellowships are also similar. Only an
admin can merge them or record that both people should remain separate. A merge
fills missing primary fields, moves matching attendance history to the primary
identity, deactivates the secondary roster record, and stores the before-state
for audit or recovery.

The migration does not modify or remove legacy data. Backfill should be a
separate reviewed operation because duplicate names and missing phone numbers
need human resolution.

## 3. Transition sequence

1. Apply the additive migration.
2. Create Supabase Auth users and matching `app_profiles` rows.
3. Audit duplicate legacy members and normalize phone numbers.
4. Backfill people and services, then link attendance using stable IDs.
5. Compare old and new dashboard totals before switching writes.
6. Retire legacy tables only after a verified backup and sign-off.

## 4. Department access

- `welfare` is redirected to `/welfare` and can access the birthday workspace
  and birthday API, but not the full attendance or member APIs.
- `first_timers` is redirected to `/first-timers` and can access visitor
  progression, but not the member roster or general analytics.
- `fellowship_leader` can access attendance and roster records only for the
  fellowship set on their account.
- `attendance` can use attendance entry but cannot open pastoral analytics.

New attendance submissions are marked as first timers automatically when no
active roster member matches the submitted phone or name/fellowship. New
visitors are not automatically added to the member roster. Advancing a visitor
journey to `member` performs that promotion deliberately.

## 5. Birthday email reminders

Vercel calls `/api/cron/birthday-reminders` daily at 08:00 UTC (08:00 in
Accra). Configure these production environment variables:

- `CRON_SECRET`: random secret used by Vercel to authorize the job.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key. Never use
  a `NEXT_PUBLIC_` prefix or expose it to client code.
- `RESEND_API_KEY`: Resend API key.
- `BIRTHDAY_REMINDER_FROM`: verified Resend sender, for example
  `ARC Welfare <birthdays@example.org>`.
- `BIRTHDAY_REMINDER_TO`: optional override; defaults to
  `lakumbie@gmail.com`.

The job sends reminders seven days and one day before each birthday. The
`notification_deliveries` table and Resend idempotency keys prevent duplicate
messages.
