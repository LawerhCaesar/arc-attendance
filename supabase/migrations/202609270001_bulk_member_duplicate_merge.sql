-- Merge a reviewed one-to-many duplicate group in one database transaction.
-- The existing pairwise merge function preserves populated primary values and
-- fills empty primary fields from each secondary record in order.

create or replace function public.merge_legacy_member_group(
  p_primary_id uuid,
  p_secondary_ids uuid[],
  p_decided_by text,
  p_reason_snapshot jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secondary_id uuid;
begin
  if p_primary_id is null then
    raise exception 'Primary member is required';
  end if;

  if coalesce(array_length(p_secondary_ids, 1), 0) = 0 then
    raise exception 'At least one secondary member is required';
  end if;

  foreach v_secondary_id in array p_secondary_ids
  loop
    if v_secondary_id is null or v_secondary_id = p_primary_id then
      continue;
    end if;

    perform public.merge_legacy_members(
      p_primary_id,
      v_secondary_id,
      p_decided_by,
      p_reason_snapshot
    );
  end loop;

  return p_primary_id;
end;
$$;

revoke all on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) from public;
revoke all on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) from anon;
revoke all on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) from authenticated;
grant execute on function public.merge_legacy_member_group(uuid, uuid[], text, jsonb) to service_role;
