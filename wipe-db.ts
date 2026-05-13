import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We try to get from env, or fallback to the known anon key from test-db-delete.mjs
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xyonwttxcbwxpwcaeidi.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5b253dHR4Y2J3eHB3Y2FlaWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTcxMTEsImV4cCI6MjA5MTIzMzExMX0.9AYYPbn1m8f26gf7X6cXe0NmZr6rOq1hjaJin4blGHQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function wipeDatabase() {
  console.log('Wiping out the database...');

  // 1. Wipe Attendance Table
  const { error: err1 } = await supabase
    .from('attendance')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletes all rows

  if (err1) {
    console.error('Failed to wipe attendance table:', err1);
  } else {
    console.log('Successfully wiped attendance table.');
  }

  // 2. Wipe Members Table
  const { error: err2 } = await supabase
    .from('members')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletes all rows

  if (err2) {
    console.error('Failed to wipe members table:', err2);
  } else {
    console.log('Successfully wiped members table.');
  }
}

wipeDatabase();
