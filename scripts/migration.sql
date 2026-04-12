-- ============================================================
-- ARC Attendance - Database Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add 'designation' column to the existing attendance table
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS designation TEXT DEFAULT 'Member';

-- 2. Backfill existing records that have NULL designation
UPDATE attendance 
SET designation = 'Member' 
WHERE designation IS NULL;

-- 3. Create the members roster table
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  fellowship TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL DEFAULT 'Member',
  birthday TEXT DEFAULT '',
  location TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Performance indexes on attendance table
CREATE INDEX IF NOT EXISTS idx_attendance_designation 
  ON attendance(designation);

CREATE INDEX IF NOT EXISTS idx_attendance_fellowship 
  ON attendance(fellowship);

CREATE INDEX IF NOT EXISTS idx_attendance_date 
  ON attendance(date);

CREATE INDEX IF NOT EXISTS idx_attendance_status 
  ON attendance("attendanceStatus");

-- 5. Performance indexes on members table
CREATE INDEX IF NOT EXISTS idx_members_fellowship 
  ON members(fellowship);

CREATE INDEX IF NOT EXISTS idx_members_designation 
  ON members(designation);

CREATE INDEX IF NOT EXISTS idx_members_active 
  ON members(is_active);

-- 6. Enable Row Level Security on members (match attendance table policy)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- 7. Allow all operations for authenticated service role (used by server-side API)
CREATE POLICY IF NOT EXISTS "Service role full access on members"
  ON members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Verification queries (run after migration to verify)
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'attendance' AND column_name = 'designation';
--
-- SELECT COUNT(*) FROM members;
-- SELECT * FROM attendance LIMIT 5;
