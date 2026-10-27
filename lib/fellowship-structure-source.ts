import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from './pagination';
import type { FellowshipCell, BsctGroup, FellowshipStructureData } from './fellowship-structure';

/** Call after authorization, with a server-resolved scope for leaders. */
export async function loadFellowshipStructure(admin: SupabaseClient, scope?: string): Promise<FellowshipStructureData> {
  let query = admin.from('fellowship_cells').select('id,fellowship,number,leader_member_id');
  if (scope) query = query.eq('fellowship', scope);
  const cells = await fetchAllRows<FellowshipCell>((from, to) => query.order('fellowship').order('number').order('id').range(from, to));
  const bsctGroups: BsctGroup[] = [];
  for (let offset = 0; offset < cells.length; offset += 100) {
    bsctGroups.push(...await fetchAllRows<BsctGroup>((from, to) => admin.from('fellowship_bsct_groups')
      .select('id,cell_id,number,leader_member_id').in('cell_id', cells.slice(offset, offset + 100).map(cell => cell.id)).order('number').order('id').range(from, to)));
  }
  return { cells, bsctGroups };
}
