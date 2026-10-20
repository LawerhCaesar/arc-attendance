-- Disposable database only; every synthetic row is rolled back.
begin;
do $$
declare
  own_id uuid := gen_random_uuid(); foreign_id uuid := gen_random_uuid(); archived_id uuid := gen_random_uuid();
  sunday date := current_date + (7-extract(dow from current_date)::int) + 70;
  saved public.fellowship_sunday_projections; rejected boolean;
begin
  insert into public.members(id,name,phone,fellowship,is_active) values
    (own_id,'Projection Test Own','','Mega',true),(foreign_id,'Projection Test Foreign','','Pleroma',true),(archived_id,'Projection Test Archived','','Mega',false);
  select * into saved from public.save_fellowship_sunday_projection(sunday,'Mega',array[own_id,own_id],0,'test-leader');
  assert saved.revision=1 and cardinality(saved.projected_member_ids)=1 and saved.submitted_at is not null, 'First save and ID deduplication';
  rejected := false;
  begin
    perform public.save_fellowship_sunday_projection(sunday,'Mega','{}',0,'stale-leader');
  exception when serialization_failure then rejected := true;
  end;
  assert rejected,'A stale revision must not overwrite a saved forecast';
  rejected := false;
  begin
    perform public.save_fellowship_sunday_projection(sunday,'Mega',array[foreign_id],1,'test-leader');
  exception when raise_exception then rejected := true;
  end;
  assert rejected,'Foreign fellowship IDs must be rejected';
  rejected := false;
  begin
    perform public.save_fellowship_sunday_projection(sunday,'Mega',array[archived_id],1,'test-leader');
  exception when raise_exception then rejected := true;
  end;
  assert rejected,'Archived member IDs must be rejected';
  select * into saved from public.save_fellowship_sunday_projection(sunday,'Mega','{}',1,'test-leader');
  assert saved.revision=2 and cardinality(saved.projected_member_ids)=0 and saved.submitted_at is not null,'Zero projection is an explicit submission';
  rejected := false;
  begin
    perform public.save_fellowship_sunday_projection(current_date-extract(dow from current_date)::int-7,'Mega','{}',0,'test-leader');
  exception when serialization_failure then rejected := true;
  end;
  assert rejected,'Past Sunday 9 a.m. cutoff must be enforced by the database';
  assert not has_table_privilege('anon','public.fellowship_sunday_projections','SELECT'),'No public reads';
  assert not has_table_privilege('authenticated','public.fellowship_sunday_projections','UPDATE'),'No direct authenticated writes';
  assert not has_function_privilege('anon','public.save_fellowship_sunday_projection(date,text,uuid[],integer,text,jsonb)','EXECUTE'),'No public RPC';
  assert has_function_privilege('service_role','public.save_fellowship_sunday_projection(date,text,uuid[],integer,text,jsonb)','EXECUTE'),'Server RPC granted';
end $$;
do $$
declare
  sunday date := current_date + (7-extract(dow from current_date)::int) + 77;
  visitor jsonb := jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Projected Visitor','phone','0557654321'));
  saved public.fellowship_sunday_projections; rejected boolean;
begin
  select * into saved from public.save_fellowship_sunday_projection(sunday,'Mega','{}',0,'test-leader',visitor);
  assert saved.projected_guests->0->>'phone'='+233557654321','Normalize saved visitor contact';
  assert (select count(*) from members where name='Projected Visitor')=0,'Projection visitors do not create roster members';
  select * into saved from public.save_fellowship_sunday_projection(sunday,'Mega','{}',1,'older-client');
  assert jsonb_array_length(saved.projected_guests)=1,'Older clients preserve visitors when omitted';
  rejected:=false;
  begin
    perform public.save_fellowship_sunday_projection(sunday,'Mega','{}',2,'test-leader',visitor||visitor);
  exception when raise_exception then rejected:=true; end;
  assert rejected,'Duplicate visitors must be rejected';
  rejected:=false;
  begin
    perform public.save_fellowship_sunday_projection(sunday,'Mega','{}',2,'test-leader','[{"id":"bad","name":"Visitor","phone":"bad"}]');
  exception when raise_exception then rejected:=true; end;
  assert rejected,'Malformed visitor details must be rejected';
  insert into members(name,phone,fellowship,is_active) values('Visitor Now Registered','0557654321','Mega',true);
  select * into saved from public.save_fellowship_sunday_projection(sunday,'Mega','{}',2,'test-leader',saved.projected_guests);
  assert saved.revision=3,'Keep previously projected visitors who later join the roster';
  rejected:=false;
  begin
    perform public.save_fellowship_sunday_projection(sunday,'Mega','{}',3,'test-leader',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Duplicate Roster','phone','0557654321')));
  exception when raise_exception then rejected:=true; end;
  assert rejected,'New visitors cannot duplicate an existing roster contact';
  select * into saved from public.save_fellowship_sunday_projection(sunday,'Mega','{}',3,'test-leader','[]');
  assert jsonb_array_length(saved.projected_guests)=0,'Explicitly removing all visitors is saved';
end $$;
rollback;
