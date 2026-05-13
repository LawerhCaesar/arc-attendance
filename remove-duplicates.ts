import { createClient } from '@supabase/supabase-js';

// We try to get from env, or fallback to the known anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xyonwttxcbwxpwcaeidi.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5b253dHR4Y2J3eHB3Y2FlaWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTcxMTEsImV4cCI6MjA5MTIzMzExMX0.9AYYPbn1m8f26gf7X6cXe0NmZr6rOq1hjaJin4blGHQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function removeDuplicates() {
  console.log('Fetching all attendance records...');
  
  const { data: records, error } = await supabase
    .from('attendance')
    .select('*')
    .order('createdAt', { ascending: true }); // Keep the oldest ones, delete newer duplicates

  if (error) {
    console.error('Error fetching records:', error);
    return;
  }

  console.log(`Found ${records?.length} total records.`);

  const seen = new Set();
  const duplicates = [];

  for (const record of (records || [])) {
    // Determine the relevant date
    const targetDate = record.attendanceDate || record.date;
    const key = `${record.name.trim().toLowerCase()}_${targetDate}`;

    if (seen.has(key)) {
      duplicates.push(record.id);
    } else {
      seen.add(key);
    }
  }

  console.log(`Found ${duplicates.length} duplicate records.`);

  if (duplicates.length > 0) {
    console.log('Deleting duplicates...');
    
    // Delete in batches of 100 to avoid query length limits
    for (let i = 0; i < duplicates.length; i += 100) {
      const batch = duplicates.slice(i, i + 100);
      const { error: delError } = await supabase
        .from('attendance')
        .delete()
        .in('id', batch);
      
      if (delError) {
        console.error('Failed to delete batch:', delError);
      } else {
        console.log(`Deleted ${batch.length} duplicates...`);
      }
    }
    console.log('Successfully removed all duplicate entries.');
  } else {
    console.log('No duplicates found.');
  }
}

removeDuplicates();
