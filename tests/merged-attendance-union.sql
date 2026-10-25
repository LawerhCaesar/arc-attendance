-- Disposable database only: exercise the real merge and roll back all fixtures.
begin;
do $$
declare
  p uuid := gen_random_uuid(); s uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  before_rows jsonb; after_rows jsonb; before_count integer;
begin
  insert into members(id,name,phone,fellowship) values
    (p,'Synthetic Abigail','0201234567','Synthetic union'),
    (s,'Synthetic Abigail Alias','0201234567','Synthetic union'),
    (other_id,'Synthetic Jonathan','0201234567','Synthetic union');
  insert into attendance(member_id,name,fellowship,"attendanceDate","attendanceStatus",date)
  select case when i<3 then p else s end,'Synthetic Abigail','Synthetic union',
    to_char(date '2026-08-30'+i*7,'YYYY-MM-DD'),'present','2026-10-25'
  from generate_series(0,7)i;
  insert into attendance(member_id,name,fellowship,phone,"attendanceDate","attendanceStatus",date) values
    (p,'Synthetic Abigail','Synthetic union','','2026-08-30','absent','2026-10-25'),
    (s,'Synthetic Abigail Alias','Synthetic union','','2026-09-06','present','2026-10-25'),
    (null,'Synthetic Jonathan','Synthetic union','0201234567','2026-10-25','present','2026-10-25');
  select count(*),jsonb_agg(jsonb_build_array(id,"attendanceDate","attendanceStatus",date) order by id)
  into before_count,before_rows from attendance where fellowship='Synthetic union';
  perform merge_legacy_member_group(p,array[s],'synthetic-union-review');
  if (select count(distinct "attendanceDate") from attendance where member_id=p and "attendanceStatus"='present')<>8 then
    raise exception '3/8 plus 5/8 did not union into 8/8';
  end if;
  if exists(select 1 from attendance where name='Synthetic Jonathan' and member_id is not null) then
    raise exception 'Shared phone stole another person\x27s legacy history';
  end if;
  select jsonb_agg(jsonb_build_array(id,"attendanceDate","attendanceStatus",date) order by id)
  into after_rows from attendance where fellowship='Synthetic union';
  if before_rows is distinct from after_rows or before_count<>(select count(*) from attendance where fellowship='Synthetic union') then
    raise exception 'Merge deleted or altered original attendance evidence';
  end if;
end $$;
rollback;
