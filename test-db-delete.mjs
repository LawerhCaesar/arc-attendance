import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xyonwttxcbwxpwcaeidi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5b253dHR4Y2J3eHB3Y2FlaWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTcxMTEsImV4cCI6MjA5MTIzMzExMX0.9AYYPbn1m8f26gf7X6cXe0NmZr6rOq1hjaJin4blGHQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanTestData() {
  console.log('Deleting test data...');
  const { data, error } = await supabase
    .from('attendance')
    .delete()
    .eq('name', 'Test Setup User');

  if (error) {
    console.error('Delete Error:', error);
  } else {
    console.log('Successfully deleted Test Setup User from attendance.');
  }
}

cleanTestData();
