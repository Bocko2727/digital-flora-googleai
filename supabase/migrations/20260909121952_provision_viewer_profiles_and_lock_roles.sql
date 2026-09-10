drop policy if exists "Profiles are writable by their owner" on public.profiles;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

create or replace function public.bootstrap_first_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'an admin profile already exists';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'target user does not exist';
  end if;

  insert into public.profiles (id, role)
  values (target_user_id, 'admin')
  on conflict (id) do update set role = 'admin', updated_at = now();
end;
$$;

revoke all on function public.bootstrap_first_admin(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_first_admin(uuid) to service_role;
