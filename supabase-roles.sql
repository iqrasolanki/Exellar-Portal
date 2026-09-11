-- Exellar Portal: Supabase schema, auth triggers, and RLS
-- Apply this in the Supabase SQL editor for the existing project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'USER' check (role in ('USER', 'ADMIN')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  submission_type text not null default 'general',
  notes text,
  source_link text,
  status text not null default 'submitted' check (status in ('submitted', 'review', 'approved', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists submissions_user_id_idx on public.submissions (user_id);
create index if not exists uploaded_files_user_id_idx on public.uploaded_files (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'USER',
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
      and p.is_active = true
  );
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
before update on public.submissions
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.uploaded_files enable row level security;

create policy "Profiles are viewable by owner or admin"
on public.profiles
for select
using (id = auth.uid() or public.is_admin());

create policy "Profiles can be inserted by self"
on public.profiles
for insert
with check (
  id = auth.uid()
  and email = auth.jwt() ->> 'email'
  and role = 'USER'
  and is_active = true
);

create policy "Users can update their own profile details"
on public.profiles
for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and email = auth.jwt() ->> 'email'
  and role = 'USER'
);

create policy "Admins can manage all profiles"
on public.profiles
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Users can view their own submissions"
on public.submissions
for select
using (user_id = auth.uid() or public.is_admin());

create policy "Users can insert their own submissions"
on public.submissions
for insert
with check (
  user_id = auth.uid()
  and title <> ''
  and status = 'submitted'
);

create policy "Users can update their own submissions"
on public.submissions
for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and title <> ''
  and status in ('submitted', 'review', 'approved', 'rejected')
);

create policy "Users can delete their own submissions"
on public.submissions
for delete
using (user_id = auth.uid());

create policy "Admins can manage all submissions"
on public.submissions
for all
using (public.is_admin())
with check (public.is_admin());

create policy "Users can view their own uploaded files"
on public.uploaded_files
for select
using (user_id = auth.uid() or public.is_admin());

create policy "Users can insert their own uploaded file metadata"
on public.uploaded_files
for insert
with check (
  user_id = auth.uid()
  and file_name <> ''
  and storage_path <> ''
);

create policy "Users can delete their own uploaded file metadata"
on public.uploaded_files
for delete
using (user_id = auth.uid());

create policy "Admins can manage all uploaded file metadata"
on public.uploaded_files
for all
using (public.is_admin())
with check (public.is_admin());

-- Optional: if you want to keep admin assignment secure through a Postgres function,
-- use the following helper in the app instead of direct updates.
create or replace function public.admin_set_profile_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  if new_role not in ('USER', 'ADMIN') then
    raise exception 'Invalid role';
  end if;

  update public.profiles
     set role = new_role,
         updated_at = now()
   where id = target_user_id;
end;
$$;

create or replace function public.admin_set_account_status(target_user_id uuid, is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  update public.profiles
     set is_active = is_active,
         updated_at = now()
   where id = target_user_id;
end;
$$;
