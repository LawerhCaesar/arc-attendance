-- Canonical fellowship rename: HSM / Tsalach -> Shalach.
-- Covers the legacy text columns and the normalized fellowship relationship.

update public.attendance
set fellowship = 'Shalach'
where lower(btrim(coalesce(fellowship, ''))) in ('hsm', 'tsalach');

update public.members
set fellowship = 'Shalach', updated_at = now()
where lower(btrim(coalesce(fellowship, ''))) in ('hsm', 'tsalach');

do $$
declare
  v_target_id uuid;
  v_source record;
begin
  insert into public.fellowships (name)
  values ('Shalach')
  on conflict (name) do nothing;

  select id into v_target_id
  from public.fellowships
  where name = 'Shalach';

  for v_source in
    select id
    from public.fellowships
    where lower(btrim(name)) in ('hsm', 'tsalach')
      and id <> v_target_id
  loop
    update public.people
    set fellowship_id = v_target_id
    where fellowship_id = v_source.id;

    delete from public.fellowships
    where id = v_source.id;
  end loop;
end;
$$;
