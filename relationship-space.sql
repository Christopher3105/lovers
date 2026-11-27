-- Lovers: shared calendar, private photo gallery, and shared to-do list.
-- This script is idempotent and has already been applied to the connected Supabase project.

create table if not exists public.relationship_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null default '',
  event_date date not null,
  color text not null default '#ff2a9d' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  repeat_yearly boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists relationship_events_title_date_uidx
  on public.relationship_events (title, event_date);
create index if not exists relationship_events_date_idx
  on public.relationship_events (event_date);
create index if not exists relationship_events_created_by_idx
  on public.relationship_events (created_by);

create table if not exists public.relationship_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  done boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists relationship_tasks_created_idx
  on public.relationship_tasks (done, created_at desc);
create index if not exists relationship_tasks_created_by_idx
  on public.relationship_tasks (created_by);

create table if not exists public.relationship_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  caption text not null default '' check (char_length(caption) <= 180),
  photo_date date not null default current_date,
  uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists relationship_photos_date_idx
  on public.relationship_photos (photo_date desc, created_at desc);
create index if not exists relationship_photos_uploaded_by_idx
  on public.relationship_photos (uploaded_by);

alter table public.relationship_events enable row level security;
alter table public.relationship_tasks enable row level security;
alter table public.relationship_photos enable row level security;

drop policy if exists "Couple members can read relationship events" on public.relationship_events;
create policy "Couple members can read relationship events"
  on public.relationship_events for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

drop policy if exists "Couple members can add relationship events" on public.relationship_events;
create policy "Couple members can add relationship events"
  on public.relationship_events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists "Couple members can update relationship events" on public.relationship_events;
create policy "Couple members can update relationship events"
  on public.relationship_events for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

drop policy if exists "Couple members can delete relationship events" on public.relationship_events;
create policy "Couple members can delete relationship events"
  on public.relationship_events for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

drop policy if exists "Couple members can read shared tasks" on public.relationship_tasks;
create policy "Couple members can read shared tasks"
  on public.relationship_tasks for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

drop policy if exists "Couple members can add shared tasks" on public.relationship_tasks;
create policy "Couple members can add shared tasks"
  on public.relationship_tasks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists "Couple members can update shared tasks" on public.relationship_tasks;
create policy "Couple members can update shared tasks"
  on public.relationship_tasks for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

drop policy if exists "Couple members can delete shared tasks" on public.relationship_tasks;
create policy "Couple members can delete shared tasks"
  on public.relationship_tasks for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

drop policy if exists "Couple members can read shared gallery" on public.relationship_photos;
create policy "Couple members can read shared gallery"
  on public.relationship_photos for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid())));

drop policy if exists "Users add their own gallery metadata" on public.relationship_photos;
create policy "Users add their own gallery metadata"
  on public.relationship_photos for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists "Users remove their own gallery metadata" on public.relationship_photos;
create policy "Users remove their own gallery metadata"
  on public.relationship_photos for delete to authenticated
  using (uploaded_by = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.relationship_events to authenticated;
grant select, insert, update, delete on public.relationship_tasks to authenticated;
grant select, insert, delete on public.relationship_photos to authenticated;

insert into public.relationship_events
  (title, description, event_date, color, repeat_yearly, created_by)
values
  ('My husband''s birthday', 'A day to celebrate him.', date '2000-03-05', '#1677ff', true, null),
  ('My wife''s birthday', 'A day to celebrate her.', date '2000-03-19', '#ff2a9d', true, null)
on conflict (title, event_date) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'relationship-gallery',
  'relationship-gallery',
  false,
  12582912,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Couple members can view gallery objects" on storage.objects;
create policy "Couple members can view gallery objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'relationship-gallery'
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists "Users upload their own gallery objects" on storage.objects;
create policy "Users upload their own gallery objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'relationship-gallery'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists "Users delete their own gallery objects" on storage.objects;
create policy "Users delete their own gallery objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'relationship-gallery'
    and owner_id = (select auth.uid())::text
  );

do $$
declare
  tbl text;
begin
  foreach tbl in array array['relationship_events','relationship_tasks','relationship_photos']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
