import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xyonwttxcbwxpwcaeidi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5b253dHR4Y2J3eHB3Y2FlaWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTcxMTEsImV4cCI6MjA5MTIzMzExMX0.9AYYPbn1m8f26gf7X6cXe0NmZr6rOq1hjaJin4blGHQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabase() {
  console.log('Testing Supabase Connection...');
  
  const record = {
    date: new Date().toISOString().split('T')[0],
    name: 'Test Setup User',
    phone: '1234567890',
    location: 'Test Location',
    birthday: '01-01',
    fellowship: 'Test Fellowship',
    firstTimer: 'No',
    designation: 'Member',
    attendanceDate: new Date().toISOString().split('T')[0],
    attendanceStatus: 'present',
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('attendance')
    .insert([record])
    .select();

  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success:', data);
  }

  const { data: fetch, error: fetchErr } = await supabase
    .from('attendance')
    .select('*')
    .limit(1);

  if (fetchErr) {
    console.error('Fetch Error:', fetchErr);
  } else {
    console.log('Fetch Success:', fetch);
  }
}

testSupabase();
