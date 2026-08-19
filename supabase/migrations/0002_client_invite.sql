-- Lets a newly-invited client finish setting up their own portal login.
-- The certifier-side "invite client" action (see app/(certifier)/settings)
-- creates the auth user via the Supabase Admin API with firm_id/client_id
-- stashed in that user's metadata; this function reads that metadata back
-- out and creates the matching profiles row — the one piece of "insert my
-- own profile" that plain RLS can't safely express, since a bare INSERT
-- policy would let a signed-up user claim any firm_id/client_id they like.

create or replace function accept_client_invite()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_meta jsonb;
  v_firm_id uuid;
  v_client_id uuid;
  v_email text;
begin
  select raw_user_meta_data, email into v_meta, v_email from auth.users where id = auth.uid();
  if v_meta is null then
    raise exception 'no authenticated user';
  end if;

  v_firm_id := (v_meta->>'firm_id')::uuid;
  v_client_id := (v_meta->>'client_id')::uuid;
  if v_firm_id is null or v_client_id is null then
    raise exception 'invite metadata missing firm_id/client_id';
  end if;

  insert into profiles (id, firm_id, role, client_id, full_name, email)
  values (auth.uid(), v_firm_id, 'client', v_client_id, (select name from clients where id = v_client_id), v_email)
  on conflict (id) do nothing;

  update clients set user_id = auth.uid() where id = v_client_id;
end;
$$;
grant execute on function accept_client_invite() to authenticated;
