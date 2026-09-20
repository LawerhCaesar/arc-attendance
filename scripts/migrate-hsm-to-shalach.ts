/**
 * One-time fallback migration: rename fellowship "HSM" or "Tsalach" to
 * "Shalach" in the legacy attendance and member tables.
 *
 * Prefer the Supabase SQL migration in production. This helper is retained for
 * installations that manage the legacy tables without the migration runner.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key);
const LEGACY_NAMES = ['HSM', 'hsm', 'Hsm', 'hSM', 'Tsalach', 'tsalach', 'TSALACH'];

async function migrateTable(table: string) {
  let totalUpdated = 0;
  for (const legacyName of LEGACY_NAMES) {
    const { data: rows, error: fetchError } = await supabase
      .from(table)
      .select('id')
      .eq('fellowship', legacyName);
    if (fetchError) throw fetchError;
    if (!rows?.length) continue;

    const ids = rows.map(row => row.id);
    for (let index = 0; index < ids.length; index += 100) {
      const { error } = await supabase
        .from(table)
        .update({ fellowship: 'Shalach' })
        .in('id', ids.slice(index, index + 100));
      if (error) throw error;
    }
    totalUpdated += ids.length;
  }
  return totalUpdated;
}

async function main() {
  const attendance = await migrateTable('attendance');
  const members = await migrateTable('members');
  console.log(`Updated ${attendance} attendance rows and ${members} member rows to Shalach.`);
}

main().catch(error => {
  console.error('Shalach migration failed:', error);
  process.exit(1);
});
